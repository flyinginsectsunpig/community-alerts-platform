package com.communityalerts.api.dto;

import com.communityalerts.api.domain.AlertCategory;
import com.communityalerts.api.domain.WatchZone;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

public record WatchZoneResponse(
        UUID id,
        String name,
        String contactEmail,
        double centerLat,
        double centerLng,
        int radiusM,
        List<AlertCategory> categories,
        List<ZonePoint> polygon,
        JsonNode shape,
        Instant createdAt) {

    public static WatchZoneResponse from(WatchZone zone) {
        List<AlertCategory> categories = zone.getCategoriesCsv().isBlank()
                ? List.of()
                : Arrays.stream(zone.getCategoriesCsv().split(","))
                        .map(String::trim)
                        .map(AlertCategory::valueOf)
                        .toList();
        return new WatchZoneResponse(
                zone.getId(),
                zone.getName(),
                zone.getContactEmail(),
                zone.getCenterLat(),
                zone.getCenterLng(),
                zone.getRadiusM(),
                categories,
                zone.getPolygon(),
                zone.getShape(),
                zone.getCreatedAt());
    }
}
