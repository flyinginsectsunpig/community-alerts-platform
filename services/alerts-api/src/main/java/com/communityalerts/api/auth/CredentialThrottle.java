package com.communityalerts.api.auth;

import com.communityalerts.api.error.TooManyRequestsException;
import com.communityalerts.api.error.UnauthorizedException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import java.util.function.Supplier;

/**
 * Throttles credential guessing on sign-in.
 *
 * <p>Counts <em>failures only</em>, so a person signing in correctly costs
 * nothing and a whole office behind one address is never throttled for using
 * the product normally. Two buckets, either of which can block:
 *
 * <ul>
 *   <li>the account being targeted, which an attacker cannot shed by moving
 *       address, and which is what actually stops credential stuffing;</li>
 *   <li>the calling address, a loose backstop against one host farming
 *       guesses across many accounts.</li>
 * </ul>
 *
 * <p>Neither bucket locks an account. They expire on their own, so nobody can
 * lock a victim out by failing on that victim's behalf. Redis being unreachable
 * fails open: a sign-in outage is worse than a window of unthrottled guessing,
 * and the bcrypt work factor still applies.
 */
@Component
public class CredentialThrottle {

    private static final Logger log = LoggerFactory.getLogger(CredentialThrottle.class);

    /** Deliberately vague: it must not reveal whether the account exists. */
    private static final String BLOCKED =
            "Too many failed sign-in attempts — please try again shortly";

    private final StringRedisTemplate redis;
    private final int failuresPerSubject;
    private final int failuresPerAddress;
    private final long windowSeconds;

    public CredentialThrottle(StringRedisTemplate redis,
                              @Value("${app.auth.throttle.failures-per-subject}") int failuresPerSubject,
                              @Value("${app.auth.throttle.failures-per-address}") int failuresPerAddress,
                              @Value("${app.auth.throttle.window-minutes}") int windowMinutes) {
        this.redis = redis;
        this.failuresPerSubject = failuresPerSubject;
        this.failuresPerAddress = failuresPerAddress;
        this.windowSeconds = windowMinutes * 60L;
    }

    /**
     * Runs {@code attempt} unless this account or address has already failed
     * too often, and counts the attempt if it turns out to be a bad credential.
     */
    public <T> T guard(String subject, String clientIp, Supplier<T> attempt) {
        String subjectKey = key("auth-sub", hash(subject));
        String addressKey = key("auth-ip", clientIp);

        if (isOver(subjectKey, failuresPerSubject) || isOver(addressKey, failuresPerAddress)) {
            throw new TooManyRequestsException(BLOCKED);
        }

        try {
            return attempt.get();
        } catch (UnauthorizedException e) {
            countFailure(subjectKey);
            countFailure(addressKey);
            throw e;
        }
    }

    private String key(String bucket, String principal) {
        return "rl:" + bucket + ":" + principal + ":" + Instant.now().getEpochSecond() / windowSeconds;
    }

    private boolean isOver(String key, int limit) {
        try {
            String seen = redis.opsForValue().get(key);
            return seen != null && Long.parseLong(seen) >= limit;
        } catch (DataAccessException | NumberFormatException e) {
            log.warn("Credential throttle unavailable; failing open", e);
            return false;
        }
    }

    private void countFailure(String key) {
        try {
            Long count = redis.opsForValue().increment(key);
            if (count != null && count == 1L) {
                // Outlive the window so a bucket opened at its last second
                // still expires rather than lingering.
                redis.expire(key, Duration.ofSeconds(windowSeconds + 30));
            }
        } catch (DataAccessException e) {
            log.warn("Could not record a failed sign-in attempt", e);
        }
    }

    /**
     * Buckets are keyed by digest, never by the address itself: these keys sit
     * in a managed Redis for the length of the window, and an email is personal
     * data even when the sign-in fails.
     */
    private static String hash(String subject) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(
                    subject.trim().toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed).substring(0, 16);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
