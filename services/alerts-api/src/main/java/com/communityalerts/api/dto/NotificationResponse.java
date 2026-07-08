package com.communityalerts.api.dto;

import com.communityalerts.api.domain.Notification;

import java.time.Instant;
import java.util.UUID;

public record NotificationResponse(
        Long id,
        UUID watchZoneId,
        UUID alertId,
        String kind,
        String message,
        Instant createdAt) {

    public static NotificationResponse from(Notification notification) {
        return new NotificationResponse(
                notification.getId(),
                notification.getWatchZoneId(),
                notification.getAlertId(),
                notification.getKind(),
                notification.getMessage(),
                notification.getCreatedAt());
    }
}
