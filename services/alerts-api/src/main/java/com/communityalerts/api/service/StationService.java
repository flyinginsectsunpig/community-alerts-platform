package com.communityalerts.api.service;

import com.communityalerts.api.dto.StationResponse;
import com.communityalerts.api.dto.StationStatsResponse;
import com.communityalerts.api.error.BadRequestException;
import com.communityalerts.api.error.NotFoundException;
import com.communityalerts.api.repository.PoliceStationRepository;
import com.communityalerts.api.repository.PoliceStationRepository.QuarterTotalRow;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;

/**
 * Official SAPS reference data: station markers for the map viewport and
 * per-station quarterly crime stats. The data changes only when the quarterly
 * import runs, so lookups are cached generously; Redis failures fall back to
 * SQL (same fail-open stance as the rest of the API).
 */
@Service
public class StationService {

    /** Headline aggregate; excluded from category lists. Comparison is case-insensitive. */
    public static final String AGGREGATE_CATEGORY = "17 community reported serious crime";

    public static final Duration CACHE_TTL = Duration.ofHours(1);

    private static final Logger log = LoggerFactory.getLogger(StationService.class);

    private final PoliceStationRepository repository;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public StationService(PoliceStationRepository repository,
                          StringRedisTemplate redis,
                          ObjectMapper objectMapper) {
        this.repository = repository;
        this.redis = redis;
        this.objectMapper = objectMapper;
    }

    private static final String[] QUARTER_LABELS = {"Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"};
    private static final int TOP_CATEGORY_LIMIT = 5;

    @Transactional(readOnly = true)
    public List<StationResponse> findInBounds(double minLat, double maxLat,
                                              double minLng, double maxLng) {
        if (minLat >= maxLat || minLng >= maxLng
                || minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) {
            throw new BadRequestException("Invalid bounding box");
        }
        String key = String.format(Locale.ROOT, "stations:bbox:%.2f:%.2f:%.2f:%.2f",
                minLat, maxLat, minLng, maxLng);
        List<StationResponse> cached = readCache(key, new TypeReference<List<StationResponse>>() {});
        if (cached != null) {
            return cached;
        }
        List<StationResponse> stations = repository.findInBounds(minLat, maxLat, minLng, maxLng)
                .stream().map(StationResponse::from).toList();
        writeCache(key, stations);
        return stations;
    }

    @Transactional(readOnly = true)
    public StationStatsResponse stats(long id) {
        String key = "stations:stats:" + id;
        StationStatsResponse cached = readCache(key, new TypeReference<StationStatsResponse>() {});
        if (cached != null) {
            return cached;
        }
        StationResponse station = repository.findById(id)
                .map(StationResponse::from)
                .orElseThrow(() -> new NotFoundException("Unknown station: " + id));
        StationStatsResponse response = buildStats(station, repository.quarterTotals(id));
        writeCache(key, response);
        return response;
    }

    private StationStatsResponse buildStats(StationResponse station, List<QuarterTotalRow> rows) {
        if (rows.isEmpty()) {
            return new StationStatsResponse(station, null, List.of());
        }
        int latestYear = 0;
        int latestQtr = 0;
        for (QuarterTotalRow row : rows) {
            if (row.getYr() > latestYear || (row.getYr() == latestYear && row.getQtr() > latestQtr)) {
                latestYear = row.getYr();
                latestQtr = row.getQtr();
            }
        }
        final int year = latestYear;
        final int qtr = latestQtr;

        // category -> quarter -> year -> total; TreeMaps keep quarters and years ordered.
        Map<String, Map<Integer, Map<Integer, Long>>> byCategory = new TreeMap<>();
        for (QuarterTotalRow row : rows) {
            byCategory.computeIfAbsent(row.getCategory(), c -> new TreeMap<>())
                    .computeIfAbsent(row.getQtr(), q -> new TreeMap<>())
                    .merge(row.getYr(), row.getTotal(), Long::sum);
        }

        String aggregateKey = byCategory.keySet().stream()
                .filter(c -> c.toLowerCase(Locale.ROOT).equals(AGGREGATE_CATEGORY))
                .findFirst().orElse(null);
        long totalSerious = 0;
        Long totalSeriousPrevYear = null;
        if (aggregateKey != null) {
            Map<Integer, Long> years = byCategory.get(aggregateKey).getOrDefault(qtr, Map.of());
            totalSerious = years.getOrDefault(year, 0L);
            totalSeriousPrevYear = years.get(year - 1);
        }

        List<StationStatsResponse.TopCategory> top = byCategory.entrySet().stream()
                .filter(e -> !e.getKey().equals(aggregateKey))
                .map(e -> {
                    Map<Integer, Long> years = e.getValue().getOrDefault(qtr, Map.of());
                    return new StationStatsResponse.TopCategory(
                            e.getKey(), years.getOrDefault(year, 0L), years.get(year - 1));
                })
                .sorted(Comparator.comparingLong(StationStatsResponse.TopCategory::count).reversed())
                .limit(TOP_CATEGORY_LIMIT)
                .toList();

        List<StationStatsResponse.CategoryStats> categories = byCategory.entrySet().stream()
                .filter(e -> !e.getKey().equals(aggregateKey))
                .map(e -> new StationStatsResponse.CategoryStats(
                        e.getKey(),
                        e.getValue().entrySet().stream()
                                .map(q -> new StationStatsResponse.Period(
                                        QUARTER_LABELS[q.getKey() - 1], toYearTotals(q.getValue())))
                                .toList()))
                .sorted(Comparator
                        .comparingLong((StationStatsResponse.CategoryStats c) ->
                                latestCount(byCategory, c.category(), qtr, year))
                        .reversed()
                        .thenComparing(StationStatsResponse.CategoryStats::category))
                .toList();

        StationStatsResponse.LatestQuarter latest = new StationStatsResponse.LatestQuarter(
                QUARTER_LABELS[qtr - 1] + " " + year, totalSerious, totalSeriousPrevYear, top);
        return new StationStatsResponse(station, latest, categories);
    }

    private static Map<String, Long> toYearTotals(Map<Integer, Long> byYear) {
        Map<String, Long> totals = new LinkedHashMap<>();
        byYear.forEach((y, total) -> totals.put(String.valueOf(y), total));
        return totals;
    }

    private static long latestCount(Map<String, Map<Integer, Map<Integer, Long>>> byCategory,
                                    String category, int qtr, int year) {
        return byCategory.getOrDefault(category, Map.of())
                .getOrDefault(qtr, Map.of())
                .getOrDefault(year, 0L);
    }

    private <T> T readCache(String key, TypeReference<T> type) {
        try {
            String cached = redis.opsForValue().get(key);
            if (cached != null) {
                return objectMapper.readValue(cached, type);
            }
        } catch (Exception e) {
            log.warn("Station cache read failed for {}", key, e);
        }
        return null;
    }

    private void writeCache(String key, Object value) {
        try {
            redis.opsForValue().set(key, objectMapper.writeValueAsString(value), CACHE_TTL);
        } catch (Exception e) {
            log.warn("Station cache write failed for {}", key, e);
        }
    }
}
