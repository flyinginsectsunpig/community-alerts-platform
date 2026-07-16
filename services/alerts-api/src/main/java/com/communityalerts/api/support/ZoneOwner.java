package com.communityalerts.api.support;

import com.communityalerts.api.auth.AuthContext;
import com.communityalerts.api.error.BadRequestException;
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
                .orElseGet(() -> new ZoneOwner(null, requireClientFingerprint(request)));
    }

    /**
     * Zone ownership treats the fingerprint as a credential, so the spoofable
     * {@code ip-} rate-limit fallback (and any header imitating it) is refused.
     */
    public static String requireClientFingerprint(HttpServletRequest request) {
        String fingerprint = ClientFingerprint.of(request);
        if (fingerprint.startsWith("ip-")) {
            throw new BadRequestException("A client fingerprint is required to own watch zones");
        }
        return fingerprint;
    }

    public boolean isAuthenticated() {
        return userId != null;
    }
}
