package com.communityalerts.api.service;

import com.communityalerts.api.dto.StatsResponse;
import com.communityalerts.api.dto.StatsSnapshot;
import com.communityalerts.api.repository.AlertRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Serves the 7-day stats snapshot. The hot path is the precomputed snapshot
 * the .NET worker maintains in Redis; the database aggregate is the fallback
 * when the cache is cold or Redis is unreachable.
 */
@Service
public class StatsService {

    public static final String STATS_KEY = "stats:7d";

    private static final Logger log = LoggerFactory.getLogger(StatsService.class);

    private final AlertRepository alertRepository;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public StatsService(AlertRepository alertRepository,
                        StringRedisTemplate redis,
                        ObjectMapper objectMapper) {
        this.alertRepository = alertRepository;
        this.redis = redis;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public StatsResponse summary() {
        try {
            String cached = redis.opsForValue().get(STATS_KEY);
            if (cached != null) {
                return new StatsResponse("cache", objectMapper.readValue(cached, StatsSnapshot.class));
            }
        } catch (Exception e) {
            log.warn("Stats cache unavailable; computing from database", e);
        }
        return new StatsResponse("database", computeFromDatabase());
    }

    private StatsSnapshot computeFromDatabase() {
        Instant since = Instant.now().minus(7, ChronoUnit.DAYS);

        Map<String, Long> byCategory = new LinkedHashMap<>();
        alertRepository.countByCategorySince(since)
                .forEach(row -> byCategory.put(row.getCategory(), row.getCnt()));

        List<StatsSnapshot.DayCount> byDay = alertRepository.countByDaySince(since)
                .stream()
                .map(row -> new StatsSnapshot.DayCount(row.getDay(), row.getCnt()))
                .toList();

        Map<String, Long> bySeverity = new LinkedHashMap<>();
        alertRepository.countBySeveritySince(since)
                .forEach(row -> bySeverity.put(row.getSeverity(), row.getCnt()));

        long total = byCategory.values().stream().mapToLong(Long::longValue).sum();
        return new StatsSnapshot(total, byCategory, byDay, bySeverity, Instant.now());
    }
}
