package com.communityalerts.api.service;

import com.communityalerts.api.dto.StatsResponse;
import com.communityalerts.api.dto.StatsSnapshot;
import com.communityalerts.api.repository.AlertRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Serves the 7-day stats snapshot. The hot path is the precomputed snapshot
 * the .NET worker maintains in Redis; the database aggregate is the fallback
 * when the cache is cold, stale, or Redis is unreachable.
 *
 * <p>Both services write the key, so the snapshot is never older than its
 * configured lifetime no matter which one wrote it last.
 */
@Service
public class StatsService {

    public static final String STATS_KEY = "stats:7d";

    private static final Logger log = LoggerFactory.getLogger(StatsService.class);

    private final AlertRepository alertRepository;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private final Duration ttl;

    public StatsService(AlertRepository alertRepository,
                        StringRedisTemplate redis,
                        ObjectMapper objectMapper,
                        @Value("${app.cache.stats-ttl-seconds}") long ttlSeconds) {
        this.alertRepository = alertRepository;
        this.redis = redis;
        this.objectMapper = objectMapper;
        this.ttl = Duration.ofSeconds(ttlSeconds);
    }

    @Transactional(readOnly = true)
    public StatsResponse summary() {
        try {
            String cached = redis.opsForValue().get(STATS_KEY);
            if (cached != null) {
                StatsSnapshot snapshot = objectMapper.readValue(cached, StatsSnapshot.class);
                if (isFresh(snapshot)) {
                    return new StatsResponse("cache", snapshot);
                }
            }
        } catch (Exception e) {
            log.warn("Stats cache unavailable; computing from database", e);
        }
        StatsSnapshot computed = computeFromDatabase();
        cache(computed);
        return new StatsResponse("database", computed);
    }

    /**
     * The worker recomputes only when an alert is ingested, so a quiet week
     * leaves the last snapshot describing a window that has since rolled past.
     * Age is checked here rather than left to Redis expiry alone: snapshots
     * written before the worker set a TTL have none, and would otherwise be
     * served as "live" indefinitely.
     */
    private boolean isFresh(StatsSnapshot snapshot) {
        Instant generatedAt = snapshot.generatedAtUtc();
        return generatedAt != null && generatedAt.isAfter(Instant.now().minus(ttl));
    }

    /**
     * Write the fallback back so a cold cache costs one aggregate query rather
     * than one per dashboard load, which matters on a metered database.
     */
    private void cache(StatsSnapshot snapshot) {
        try {
            redis.opsForValue().set(STATS_KEY, objectMapper.writeValueAsString(snapshot), ttl);
        } catch (Exception e) {
            log.warn("Could not write the stats snapshot back to the cache", e);
        }
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
