package com.communityalerts.api.web;

import com.communityalerts.api.auth.AuthContext;
import com.communityalerts.api.support.ClientFingerprint;
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
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    private final StringRedisTemplate redis;
    private final int maxPerMinute;

    public RateLimitFilter(StringRedisTemplate redis,
                           @Value("${app.rate-limit.max-per-minute}") int maxPerMinute) {
        this.redis = redis;
        this.maxPerMinute = maxPerMinute;
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
                || uri.startsWith("/api/v1/auth/"); // brute-force protection
        return !limited;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String window = String.valueOf(Instant.now().getEpochSecond() / 60);
        // Signed-in traffic is limited per account (stable across devices);
        // anonymous traffic falls back to the client fingerprint.
        String principal = AuthContext.optional(request)
                .map(user -> "u-" + user.id())
                .orElseGet(() -> ClientFingerprint.of(request));
        String key = "rl:" + principal + ":" + window;

        try {
            Long count = redis.opsForValue().increment(key);
            if (count != null && count == 1) {
                redis.expire(key, Duration.ofSeconds(90));
            }
            if (count != null && count > maxPerMinute) {
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
