package com.communityalerts.api.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SeverityPreview(String severity, double riskScore, String modelVersion) {
}
