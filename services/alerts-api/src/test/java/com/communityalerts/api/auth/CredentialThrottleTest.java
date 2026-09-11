package com.communityalerts.api.auth;

import com.communityalerts.api.error.TooManyRequestsException;
import com.communityalerts.api.error.UnauthorizedException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CredentialThrottleTest {

    private static final String EMAIL = "sam@example.com";
    private static final String ADDRESS = "203.0.113.7";
    private static final int PER_SUBJECT = 10;
    private static final int PER_ADDRESS = 50;
    private static final int WINDOW_MINUTES = 15;

    @Mock
    private StringRedisTemplate redis;

    @Mock
    private ValueOperations<String, String> valueOps;

    private CredentialThrottle throttle;

    @BeforeEach
    void setUp() {
        lenient().when(redis.opsForValue()).thenReturn(valueOps);
        throttle = new CredentialThrottle(redis, PER_SUBJECT, PER_ADDRESS, WINDOW_MINUTES);
    }

    @Test
    @DisplayName("a successful attempt consumes none of the failure budget")
    void successConsumesNothing() {
        String result = throttle.guard(EMAIL, ADDRESS, () -> "token");

        assertThat(result).isEqualTo("token");
        verify(valueOps, never()).increment(anyString());
    }

    @Test
    @DisplayName("a failed attempt counts against both the account and the address")
    void failureCountsAgainstBothBuckets() {
        assertThatThrownBy(() -> throttle.guard(EMAIL, ADDRESS, () -> {
            throw new UnauthorizedException("Invalid email or password");
        })).isInstanceOf(UnauthorizedException.class);

        assertThat(incrementedKeys()).hasSize(2);
    }

    @Test
    @DisplayName("the account bucket blocks further attempts once its limit is reached")
    void subjectLimitBlocks() {
        when(valueOps.get(anyString())).thenAnswer(invocation -> {
            String key = invocation.getArgument(0);
            return key.contains("auth-sub") ? String.valueOf(PER_SUBJECT) : "0";
        });
        AtomicInteger attempts = new AtomicInteger();

        assertThatThrownBy(() -> throttle.guard(EMAIL, ADDRESS, () -> {
            attempts.incrementAndGet();
            return "token";
        })).isInstanceOf(TooManyRequestsException.class);

        assertThat(attempts.get()).isZero();
    }

    @Test
    @DisplayName("the address bucket blocks further attempts once its limit is reached")
    void addressLimitBlocks() {
        when(valueOps.get(anyString())).thenAnswer(invocation -> {
            String key = invocation.getArgument(0);
            return key.contains("auth-ip") ? String.valueOf(PER_ADDRESS) : "0";
        });
        AtomicInteger attempts = new AtomicInteger();

        assertThatThrownBy(() -> throttle.guard(EMAIL, ADDRESS, () -> {
            attempts.incrementAndGet();
            return "token";
        })).isInstanceOf(TooManyRequestsException.class);

        assertThat(attempts.get()).isZero();
    }

    @Test
    @DisplayName("a wrong password below the limit still reaches the credential check")
    void belowLimitPassesThrough() {
        when(valueOps.get(anyString())).thenReturn(String.valueOf(PER_SUBJECT - 1));

        String result = throttle.guard(EMAIL, ADDRESS, () -> "token");

        assertThat(result).isEqualTo("token");
    }

    @Test
    @DisplayName("the email never appears in a Redis key")
    void emailIsNotStoredInTheKey() {
        assertThatThrownBy(() -> throttle.guard(EMAIL, ADDRESS, () -> {
            throw new UnauthorizedException("Invalid email or password");
        })).isInstanceOf(UnauthorizedException.class);

        assertThat(incrementedKeys()).isNotEmpty().allSatisfy(key ->
                assertThat(key).doesNotContain(EMAIL).doesNotContain("sam"));
    }

    @Test
    @DisplayName("the same account is counted regardless of how the email is capitalised")
    void subjectKeyIsCaseInsensitive() {
        failOnce(EMAIL);
        failOnce("Sam@Example.COM");

        ArgumentCaptor<String> keys = ArgumentCaptor.forClass(String.class);
        verify(valueOps, times(4)).increment(keys.capture());
        java.util.List<String> subjectKeys = keys.getAllValues().stream()
                .filter(key -> key.contains("auth-sub"))
                .distinct()
                .toList();

        assertThat(subjectKeys).hasSize(1);
    }

    private void failOnce(String email) {
        assertThatThrownBy(() -> throttle.guard(email, ADDRESS, () -> {
            throw new UnauthorizedException("Invalid email or password");
        })).isInstanceOf(UnauthorizedException.class);
    }

    @Test
    @DisplayName("an unreachable Redis lets the credential check proceed")
    void failsOpenWhenRedisUnavailable() {
        when(valueOps.get(anyString())).thenThrow(new QueryTimeoutException("redis down"));

        String result = throttle.guard(EMAIL, ADDRESS, () -> "token");

        assertThat(result).isEqualTo("token");
    }

    private java.util.List<String> incrementedKeys() {
        ArgumentCaptor<String> keys = ArgumentCaptor.forClass(String.class);
        verify(valueOps, times(2)).increment(keys.capture());
        return keys.getAllValues();
    }
}
