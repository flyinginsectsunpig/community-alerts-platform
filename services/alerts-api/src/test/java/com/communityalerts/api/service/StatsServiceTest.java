package com.communityalerts.api.service;

import com.communityalerts.api.dto.StatsResponse;
import com.communityalerts.api.dto.StatsSnapshot;
import com.communityalerts.api.repository.AlertRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StatsServiceTest {

    @Mock
    private AlertRepository alertRepository;
    @Mock
    private StringRedisTemplate redis;
    @Mock
    private ValueOperations<String, String> valueOperations;

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    private StatsService statsService;

    @BeforeEach
    void setUp() {
        statsService = new StatsService(alertRepository, redis, objectMapper);
    }

    @Test
    @DisplayName("summary served from the worker-maintained Redis snapshot when present")
    void summaryFromCache() throws Exception {
        StatsSnapshot snapshot = new StatsSnapshot(
                12,
                Map.of("THEFT", 8L, "HAZARD", 4L),
                List.of(new StatsSnapshot.DayCount("2026-07-07", 12)),
                Map.of("HIGH", 3L, "LOW", 9L),
                Instant.parse("2026-07-08T10:00:00Z"));
        when(redis.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(StatsService.STATS_KEY))
                .thenReturn(objectMapper.writeValueAsString(snapshot));

        StatsResponse response = statsService.summary();

        assertThat(response.source()).isEqualTo("cache");
        assertThat(response.stats().total()).isEqualTo(12);
        assertThat(response.stats().byCategory()).containsEntry("THEFT", 8L);
        verify(alertRepository, never()).countByCategorySince(any());
    }

    @Test
    @DisplayName("summary falls back to database aggregates on cache miss")
    void summaryFromDatabase() {
        when(redis.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(StatsService.STATS_KEY)).thenReturn(null);

        when(alertRepository.countByCategorySince(any())).thenReturn(List.of(
                categoryRow("THEFT", 5),
                categoryRow("ASSAULT", 2)));
        when(alertRepository.countByDaySince(any())).thenReturn(List.of(
                dayRow("2026-07-07", 4),
                dayRow("2026-07-08", 3)));
        when(alertRepository.countBySeveritySince(any())).thenReturn(List.of(
                severityRow("HIGH", 2),
                severityRow("LOW", 5)));

        StatsResponse response = statsService.summary();

        assertThat(response.source()).isEqualTo("database");
        assertThat(response.stats().total()).isEqualTo(7);
        assertThat(response.stats().byDay()).hasSize(2);
        assertThat(response.stats().bySeverity()).containsEntry("HIGH", 2L);
    }

    private static AlertRepository.CategoryCountRow categoryRow(String category, long count) {
        return new AlertRepository.CategoryCountRow() {
            @Override public String getCategory() { return category; }
            @Override public long getCnt() { return count; }
        };
    }

    private static AlertRepository.DayCountRow dayRow(String day, long count) {
        return new AlertRepository.DayCountRow() {
            @Override public String getDay() { return day; }
            @Override public long getCnt() { return count; }
        };
    }

    private static AlertRepository.SeverityCountRow severityRow(String severity, long count) {
        return new AlertRepository.SeverityCountRow() {
            @Override public String getSeverity() { return severity; }
            @Override public long getCnt() { return count; }
        };
    }
}
