package com.communityalerts.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 2, max = 60)
        @Pattern(regexp = "[\\p{L}\\p{N} ._-]+", message = "may contain letters, numbers, spaces, . _ -")
        String displayName,
        /* bcrypt truncates beyond 72 bytes, so cap there */
        @NotBlank @Size(min = 8, max = 72) String password) {
}
