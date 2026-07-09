package com.communityalerts.api.auth;

import java.util.UUID;

/** The authenticated principal extracted from a verified JWT. */
public record AuthUser(UUID id, String displayName) {
}
