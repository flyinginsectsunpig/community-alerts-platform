package com.communityalerts.api.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * @param riskScore null when the model abstained — it recognised nothing in the
 *                  description and has no score to give. Boxed rather than
 *                  primitive so that stays distinct from a genuine 0.0.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SeverityPreview(String severity, Double riskScore, String modelVersion) {
}
