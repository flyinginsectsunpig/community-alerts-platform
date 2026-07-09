package com.communityalerts.api.dto;

import java.time.Instant;
import java.util.UUID;

public record AuthResponse(
        String token,
        UUID userId,
        String displayName,
        String email,
        Instant expiresAt) {
}
