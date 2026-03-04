package com.communityalerts.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-IP rate limiting using Bucket4j token-bucket algorithm.
 *
 * Why this matters for Community Alerts:
 * Burst reports of the same incident (e.g. 50 people pinging a car crash)
 * could overwhelm the heat score recalculation pipeline. Throttling at
 * the controller layer keeps the system stable under viral local events.
 *
 * In production, replace the in-memory ConcurrentHashMap with
 * a Redis-backed distributed cache so throttling works across
 * multiple backend instances.
 */
@Component
@Slf4j
public class RateLimitFilter {

    @Value("${app.rate-limit.incident-capacity:10}")
    private int incidentCapacity;

    @Value("${app.rate-limit.comment-capacity:20}")
    private int commentCapacity;

    private final Map<String, Bucket> incidentBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> commentBuckets = new ConcurrentHashMap<>();

    public void checkIncidentLimit(String ip) {
        Bucket bucket = incidentBuckets.computeIfAbsent(ip, k -> Bucket.builder()
                .addLimit(Bandwidth.classic(
                        incidentCapacity,
                        Refill.greedy(incidentCapacity, Duration.ofMinutes(1))))
                .build());
        if (!bucket.tryConsume(1)) {
            log.warn("Rate limit exceeded for incident reports — ip={}", ip);
            throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "Too many incident reports. Please wait before submitting another.");
        }
    }

    public void checkCommentLimit(String ip) {
        Bucket bucket = commentBuckets.computeIfAbsent(ip, k -> Bucket.builder()
                .addLimit(Bandwidth.classic(
                        commentCapacity,
                        Refill.greedy(commentCapacity, Duration.ofMinutes(1))))
                .build());
        if (!bucket.tryConsume(1)) {
            log.warn("Rate limit exceeded for comments — ip={}", ip);
            throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "You're commenting too fast. Please slow down.");
        }
    }
}
