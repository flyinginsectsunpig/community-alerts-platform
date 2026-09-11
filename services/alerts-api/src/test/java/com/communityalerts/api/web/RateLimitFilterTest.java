package com.communityalerts.api.web;

import com.communityalerts.api.auth.AuthContext;
import com.communityalerts.api.auth.AuthUser;
import com.communityalerts.api.support.ClientFingerprint;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RateLimitFilterTest {

    private static final String LOGIN = "/api/v1/auth/login";
    private static final int MAX_PER_MINUTE = 10;

    @Mock
    private StringRedisTemplate redis;

    @Mock
    private ValueOperations<String, String> valueOps;

    private RateLimitFilter filter;

    @BeforeEach
    void setUp() {
        when(redis.opsForValue()).thenReturn(valueOps);
        when(valueOps.increment(anyString())).thenReturn(2L);
        filter = new RateLimitFilter(redis, MAX_PER_MINUTE);
    }

    @Test
    @DisplayName("login attempts from one address share a bucket even when the fingerprint header changes")
    void loginBucketIgnoresClientSuppliedFingerprint() throws Exception {
        filter.doFilter(loginRequest("203.0.113.7", "fp-aaaaaaaa"),
                new MockHttpServletResponse(), new MockFilterChain());
        filter.doFilter(loginRequest("203.0.113.7", "fp-bbbbbbbb"),
                new MockHttpServletResponse(), new MockFilterChain());

        assertThat(principalsOfCapturedKeys()).containsExactly("ip-203.0.113.7", "ip-203.0.113.7");
    }

    @Test
    @DisplayName("only the rightmost X-Forwarded-For entry counts, so a spoofed prefix cannot split the bucket")
    void loginBucketIgnoresSpoofedForwardedPrefix() throws Exception {
        filter.doFilter(loginRequest("10.0.0.1, 203.0.113.7", "fp-aaaaaaaa"),
                new MockHttpServletResponse(), new MockFilterChain());
        filter.doFilter(loginRequest("10.9.9.9, 203.0.113.7", "fp-bbbbbbbb"),
                new MockHttpServletResponse(), new MockFilterChain());

        assertThat(principalsOfCapturedKeys()).containsExactly("ip-203.0.113.7", "ip-203.0.113.7");
    }

    @Test
    @DisplayName("different client addresses get their own buckets")
    void separateAddressesGetSeparateBuckets() throws Exception {
        filter.doFilter(loginRequest("203.0.113.7", "fp-aaaaaaaa"),
                new MockHttpServletResponse(), new MockFilterChain());
        filter.doFilter(loginRequest("198.51.100.4", "fp-aaaaaaaa"),
                new MockHttpServletResponse(), new MockFilterChain());

        assertThat(principalsOfCapturedKeys()).containsExactly("ip-203.0.113.7", "ip-198.51.100.4");
    }

    @Test
    @DisplayName("signed-in traffic is still limited per account, not per address")
    void authenticatedTrafficKeysOnTheAccount() throws Exception {
        UUID userId = UUID.randomUUID();

        MockHttpServletRequest first = loginRequest("203.0.113.7", "fp-aaaaaaaa");
        first.setRequestURI("/api/v1/alerts");
        first.setAttribute(AuthContext.ATTRIBUTE, new AuthUser(userId, "Sam"));

        MockHttpServletRequest second = loginRequest("198.51.100.4", "fp-bbbbbbbb");
        second.setRequestURI("/api/v1/alerts");
        second.setAttribute(AuthContext.ATTRIBUTE, new AuthUser(userId, "Sam"));

        filter.doFilter(first, new MockHttpServletResponse(), new MockFilterChain());
        filter.doFilter(second, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(principalsOfCapturedKeys()).containsExactly("u-" + userId, "u-" + userId);
    }

    /**
     * The trailing window number turns over on the minute, so assert on the
     * principal segment rather than the whole key.
     */
    private List<String> principalsOfCapturedKeys() {
        ArgumentCaptor<String> keys = ArgumentCaptor.forClass(String.class);
        verify(valueOps, times(2)).increment(keys.capture());
        return keys.getAllValues().stream()
                .map(key -> key.substring("rl:".length(), key.lastIndexOf(':')))
                .toList();
    }

    private static MockHttpServletRequest loginRequest(String forwardedFor, String fingerprint) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", LOGIN);
        request.addHeader("X-Forwarded-For", forwardedFor);
        request.addHeader(ClientFingerprint.HEADER, fingerprint);
        return request;
    }
}
