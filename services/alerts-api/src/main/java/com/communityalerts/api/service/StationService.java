package com.communityalerts.api.service;

import com.communityalerts.api.dto.StationResponse;
import com.communityalerts.api.error.BadRequestException;
import com.communityalerts.api.repository.PoliceStationRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;
import java.util.Locale;

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
