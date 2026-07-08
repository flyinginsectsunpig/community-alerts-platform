package com.communityalerts.api.support;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Lightweight anonymous identity: the frontend sends a stable random token in
 * X-Client-Fingerprint; requests without one fall back to a hash of the
 * caller's address. Used for rate limiting and duplicate-confirmation checks.
 */
public final class ClientFingerprint {

    public static final String HEADER = "X-Client-Fingerprint";
    private static final int MAX_LENGTH = 64;

    private ClientFingerprint() {
    }

    public static String of(HttpServletRequest request) {
        String header = request.getHeader(HEADER);
        if (header != null && !header.isBlank() && header.length() <= MAX_LENGTH
                && header.chars().allMatch(c -> Character.isLetterOrDigit(c) || c == '-')) {
            return header;
        }
        String address = request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
        return "ip-" + Integer.toHexString(address.hashCode());
    }
}
