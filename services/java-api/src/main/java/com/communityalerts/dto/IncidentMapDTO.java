package com.communityalerts.dto;

import com.communityalerts.model.IncidentType;

public record IncidentMapDTO(
    Long id,
    String suburbId,
    IncidentType type,
    int severity,
    double latitude,
    double longitude
) {}
