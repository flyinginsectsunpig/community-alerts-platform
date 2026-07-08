package com.communityalerts.api.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Shape shared with the .NET alert-processor, which precomputes this snapshot
 * into Redis under {@code stats:7d}. Field names must stay in sync.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record StatsSnapshot(
        long total,
        Map<String, Long> byCategory,
        List<DayCount> byDay,
        Map<String, Long> bySeverity,
        Instant generatedAtUtc) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DayCount(String day, long count) {
    }
}
