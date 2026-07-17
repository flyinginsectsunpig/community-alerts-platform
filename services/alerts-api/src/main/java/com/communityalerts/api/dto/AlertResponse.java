package com.communityalerts.api.dto;

import com.communityalerts.api.domain.Alert;
import com.communityalerts.api.domain.AlertCategory;
import com.communityalerts.api.domain.AlertStatus;
import com.communityalerts.api.domain.Severity;

import java.time.Instant;
import java.util.UUID;

public record AlertResponse(
        UUID id,
        AlertCategory category,
        String description,
        double lat,
        double lng,
        Severity severity,
        Double riskScore,
        AlertStatus status,
        int confirmationCount,
        int commentCount,
        /* null on alerts reported before accounts were required */
        UUID reportedByUserId,
        Instant createdAt,
        Instant updatedAt) {

    public static AlertResponse from(Alert alert) {
        return new AlertResponse(
                alert.getId(),
                alert.getCategory(),
                alert.getDescription(),
                alert.getLat(),
                alert.getLng(),
                alert.getSeverity(),
                alert.getRiskScore(),
                alert.getStatus(),
                alert.getConfirmationCount(),
                alert.getCommentCount(),
                alert.getReportedByUserId(),
                alert.getCreatedAt(),
                alert.getUpdatedAt());
    }
}
