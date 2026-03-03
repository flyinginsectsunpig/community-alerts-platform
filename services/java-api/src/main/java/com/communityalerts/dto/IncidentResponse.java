package com.communityalerts.dto;

import com.communityalerts.model.IncidentType;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Safe outbound representation of an incident.
 * No reporter data is included.
 */
public record IncidentResponse(
    Long id,
    String suburbId,
    String suburbName,
    IncidentType type,
    String typeLabel,
    String title,
    String description,
    List<String> tags,
    Integer severity,
    Double latitude,
    Double longitude,
    LocalDateTime createdAt,
    int commentCount
) {}
