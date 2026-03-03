package com.communityalerts.dto;

/**
 * Suburb data including calculated heat score and derived alert level.
 */
public record SuburbResponse(
    String id,
    String name,
    Double latitude,
    Double longitude,
    Integer heatScore,
    String alertLevel,     // GREEN | YELLOW | ORANGE | RED
    int incidentCount
) {}
