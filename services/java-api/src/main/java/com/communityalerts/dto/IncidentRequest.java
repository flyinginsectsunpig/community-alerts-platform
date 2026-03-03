package com.communityalerts.dto;

import com.communityalerts.model.IncidentType;
import jakarta.validation.constraints.*;

import java.util.List;

/**
 * Inbound payload to create an incident.
 * Deliberately excludes any reporter identity fields.
 */
public record IncidentRequest(

    @NotNull(message = "Incident type is required")
    IncidentType type,

    @NotBlank(message = "Title is required")
    @Size(min = 5, max = 200, message = "Title must be between 5 and 200 characters")
    String title,

    @NotBlank(message = "Description is required")
    @Size(min = 10, max = 2000, message = "Description must be between 10 and 2000 characters")
    String description,

    List<@Size(max = 100) String> tags,

    @NotBlank(message = "Suburb ID is required")
    String suburbId,

    @NotNull(message = "Latitude is required")
    @DecimalMin(value = "-35.0", message = "Latitude out of Cape Town bounds")
    @DecimalMax(value = "-33.0", message = "Latitude out of Cape Town bounds")
    Double latitude,

    @NotNull(message = "Longitude is required")
    @DecimalMin(value = "17.5", message = "Longitude out of Cape Town bounds")
    @DecimalMax(value = "19.5", message = "Longitude out of Cape Town bounds")
    Double longitude,

    @Min(value = 1, message = "Severity must be between 1 and 5")
    @Max(value = 5, message = "Severity must be between 1 and 5")
    Integer severity
) {}
