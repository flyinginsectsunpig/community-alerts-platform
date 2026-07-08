package com.communityalerts.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SeverityPreviewRequest(@NotBlank @Size(min = 3, max = 2000) String text) {
}
