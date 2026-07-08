package com.communityalerts.api.messaging.events;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.Instant;
import java.util.UUID;

/**
 * Published by the Python ML service on routing key {@code alert.scored}.
 * Coordinates and category are echoed so consumers avoid a database read.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AlertScoredEvent(
        UUID alertId,
        String severity,
        double riskScore,
        String modelVersion,
        String category,
        double lat,
        double lng,
        Instant scoredAt) {
}
