package com.communityalerts.api.messaging.events;

import java.time.Instant;
import java.util.UUID;

/**
 * Published on routing key {@code alert.created}. Consumed by the Python ML
 * service (severity scoring) and the .NET worker (watch-zone matching, stats).
 */
public record AlertCreatedEvent(
        UUID alertId,
        String category,
        String description,
        double lat,
        double lng,
        Instant createdAt) {
}
