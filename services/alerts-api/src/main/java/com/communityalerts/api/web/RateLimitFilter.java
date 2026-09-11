package com.communityalerts.api.web;

import com.communityalerts.api.auth.AuthContext;
import com.communityalerts.api.support.ClientIp;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;

/**
 * Redis fixed-window rate limiter on write endpoints (report, confirm,
 * watch-zone create/update/delete/claim) to blunt spam and abuse. Fails open if Redis is
 * unreachable — availability of reporting wins over strict limiting.
 *
 * <p>Reads are never limited, so opening the dashboard during a local emergency
 * costs nothing however many people do it at once. Sign-in is handled by
 * {@link com.communityalerts.api.auth.CredentialThrottle}, which counts failed
 * attempts rather than attempts.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    private static final String LOGIN = "/api/v1/auth/login";

    private final StringRedisTemplate redis;
    private final int maxPerMinute;
    private final int anonymousMaxPerMinute;

    public RateLimitFilter(StringRedisTemplate redis,
                           @Value("${app.rate-limit.max-per-minute}") int maxPerMinute,
                           @Value("${app.rate-limit.anonymous-max-per-minute}") int anonymousMaxPerMinute) {
        this.redis = redis;
        this.maxPerMinute = maxPerMinute;
        this.anonymousMaxPerMinute = anonymousMaxPerMinute;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String method = request.getMethod();
        String uri = request.getRequestURI();
        if (("PUT".equals(method) || "DELETE".equals(method))
                && (uri.startsWith("/api/v1/watch-zones/") || uri.startsWith("/api/v1/push/"))) {
            return false;
        }
        if (!"POST".equals(method)) {
            return true;
        }
        boolean limited = uri.equals("/api/v1/alerts")
                || uri.endsWith("/confirm")
                || uri.endsWith("/resolve")
                || uri.endsWith("/comments")
                || uri.startsWith("/api/v1/watch-zones") // create + claim
                || uri.startsWith("/api/v1/push/") // subscription writes
                // Sign-in is throttled on failures by CredentialThrottle
                // instead, so people signing in correctly never spend the
                // budget of everyone behind their address. The rest of the auth
                // family stays here: creating an account and sending a reset
                // email are worth bounding even when they succeed.
                || (uri.startsWith("/api/v1/auth/") && !LOGIN.equals(uri));
        return !limited;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String window = String.valueOf(Instant.now().getEpochSecond() / 60);
        // Signed-in traffic is limited per account (stable across devices);
        // anonymous traffic falls back to the calling address. Deliberately not
        // the client fingerprint: that header is chosen by the caller, so
        // rotating it per request shed the limit entirely.
        //
        // An address is shared — a mobile carrier's NAT pool, an office, a
        // campus — so its ceiling is the higher of the two. An account is one
        // person and keeps the tighter one.
        var authenticated = AuthContext.optional(request);
        String principal = authenticated
                .map(user -> "u-" + user.id())
                .orElseGet(() -> "ip-" + ClientIp.of(request));
        int limit = authenticated.isPresent() ? maxPerMinute : anonymousMaxPerMinute;
        String key = "rl:" + principal + ":" + window;

        try {
            Long count = redis.opsForValue().increment(key);
            if (count != null && count == 1) {
                redis.expire(key, Duration.ofSeconds(90));
            }
            if (count != null && count > limit) {
                response.setStatus(429);
                response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
                response.getWriter().write(
                        "{\"status\":429,\"title\":\"Too Many Requests\","
                        + "\"detail\":\"Rate limit exceeded — try again in a minute\"}");
                return;
            }
        } catch (DataAccessException e) {
            log.warn("Rate limiter unavailable; failing open", e);
        }

        filterChain.doFilter(request, response);
    }
}
