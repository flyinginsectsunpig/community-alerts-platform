package com.communityalerts.api.support;

import com.communityalerts.api.auth.AuthContext;
import jakarta.servlet.http.HttpServletRequest;

import java.util.UUID;

/**
 * The identity a watch zone belongs to: the authenticated user when a valid
 * JWT is present, otherwise the anonymous client fingerprint. Exactly one of
 * the two fields is non-null.
 */
public record ZoneOwner(UUID userId, String fingerprint) {

    public ZoneOwner {
        if ((userId == null) == (fingerprint == null)) {
            throw new IllegalArgumentException("Exactly one of userId and fingerprint must be set");
        }
    }

    public static ZoneOwner resolve(HttpServletRequest request) {
        return AuthContext.optional(request)
                .map(user -> new ZoneOwner(user.id(), null))
                .orElseGet(() -> new ZoneOwner(null, ClientFingerprint.of(request)));
    }

    public boolean isAuthenticated() {
        return userId != null;
    }
}
