package com.communityalerts.api.support;

import jakarta.servlet.http.HttpServletRequest;

/**
 * The caller's network address, as observed by the ingress in front of us.
 *
 * <p>Unlike {@link ClientFingerprint} this is not self-asserted, so it is the
 * identity to use for controls a caller must not be able to shed — rate limits
 * above all. Azure Container Apps' Envoy ingress <em>appends</em> the address it
 * saw to {@code X-Forwarded-For}, so only the rightmost entry is the platform's
 * word; everything to the left of it was supplied by the caller and is ignored.
 * Running behind a different number of proxies changes which entry is
 * trustworthy — revisit this if the ingress ever changes.
 */
public final class ClientIp {

    public static final String HEADER = "X-Forwarded-For";

    /** Longest possible IPv6 address, including an IPv4-mapped tail. */
    private static final int MAX_LENGTH = 45;

    private ClientIp() {
    }

    public static String of(HttpServletRequest request) {
        String forwarded = request.getHeader(HEADER);
        if (forwarded != null) {
            String rightmost = forwarded.substring(forwarded.lastIndexOf(',') + 1).trim();
            if (!rightmost.isEmpty() && rightmost.length() <= MAX_LENGTH) {
                return rightmost;
            }
        }
        String address = request.getRemoteAddr();
        return address == null || address.isBlank() ? "unknown" : address;
    }
}
