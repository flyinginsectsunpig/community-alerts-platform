package com.communityalerts.api.dto;

import com.communityalerts.api.domain.AlertCategory;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateWatchZoneRequest(
        @NotBlank @Size(max = 120) String name,
        /* optional — null or blank means no notification email for this zone */
        @Email @Size(max = 254) String contactEmail,
        /* centre and radius are required for a circle; ignored (recomputed) when polygon is sent */
        @DecimalMin("-90") @DecimalMax("90") Double centerLat,
        @DecimalMin("-180") @DecimalMax("180") Double centerLng,
        @Min(100) @Max(10000) Integer radiusM,
        /* null or empty means subscribe to all categories */
        List<AlertCategory> categories,
        /* drawn outline; null for a circle. Sent together with shape. */
        @Size(max = 500, message = "A drawn zone can have at most 500 points") List<@NotNull @Valid ZonePoint> polygon,
        /* client-owned shape description, opaque to the API; null for a circle */
        JsonNode shape) {
}
