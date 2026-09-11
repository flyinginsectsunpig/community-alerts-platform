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
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RateLimitFilterTest {

    private static final String WATCH_ZONES = "/api/v1/watch-zones";
    private static final String LOGIN = "/api/v1/auth/login";
    private static final String SIGNUP = "/api/v1/auth/signup";
    private static final int ACCOUNT_LIMIT = 10;
    private static final int ANONYMOUS_LIMIT = 30;

    @Mock
    private StringRedisTemplate redis;

    @Mock
    private ValueOperations<String, String> valueOps;

    private RateLimitFilter filter;

    @BeforeEach
    void setUp() {
        lenient().when(redis.opsForValue()).thenReturn(valueOps);
        filter = new RateLimitFilter(redis, ACCOUNT_LIMIT, ANONYMOUS_LIMIT);
    }

    @Test
    @DisplayName("anonymous writes share a bucket per address even when the fingerprint header changes")
    void anonymousWritesKeyOnTheCallingAddress() throws Exception {
        allowRequests();

        send(write(WATCH_ZONES, "203.0.113.7", "fp-aaaaaaaa"));
        send(write(WATCH_ZONES, "203.0.113.7", "fp-bbbbbbbb"));

        assertThat(principals()).containsExactly("ip-203.0.113.7", "ip-203.0.113.7");
    }

    @Test
    @DisplayName("only the rightmost forwarded entry counts, so a spoofed prefix cannot split the bucket")
    void spoofedForwardedPrefixCannotSplitTheBucket() throws Exception {
        allowRequests();

        send(write(WATCH_ZONES, "10.0.0.1, 203.0.113.7", "fp-aaaaaaaa"));
        send(write(WATCH_ZONES, "10.9.9.9, 203.0.113.7", "fp-bbbbbbbb"));

        assertThat(principals()).containsExactly("ip-203.0.113.7", "ip-203.0.113.7");
    }

    @Test
    @DisplayName("signed-in traffic is limited per account, not per address")
    void authenticatedTrafficKeysOnTheAccount() throws Exception {
        allowRequests();
        UUID userId = UUID.randomUUID();

        send(signedIn(write(WATCH_ZONES, "203.0.113.7", "fp-aaaaaaaa"), userId));
        send(signedIn(write(WATCH_ZONES, "198.51.100.4", "fp-bbbbbbbb"), userId));

        assertThat(principals()).containsExactly("u-" + userId, "u-" + userId);
    }

    @Test
    @DisplayName("sign-in is left to the credential throttle, which counts failures rather than attempts")
    void loginIsNotHandledByThisFilter() throws Exception {
        send(write(LOGIN, "203.0.113.7", "fp-aaaaaaaa"));

        verify(valueOps, never()).increment(anyString());
    }

    @Test
    @DisplayName("signup still costs a request, so accounts cannot be created without bound")
    void signupIsStillLimited() throws Exception {
        allowRequests();

        send(write(SIGNUP, "203.0.113.7", "fp-aaaaaaaa"));

        assertThat(principals()).containsExactly("ip-203.0.113.7");
    }

    @Test
    @DisplayName("an anonymous address may write well past the per-account ceiling")
    void anonymousCeilingIsHigherThanTheAccountCeiling() throws Exception {
        when(valueOps.increment(anyString())).thenReturn((long) ACCOUNT_LIMIT + 1);

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(write(WATCH_ZONES, "203.0.113.7", "fp-aaaaaaaa"), response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isNotNull();
    }

    @Test
    @DisplayName("an anonymous address is refused once it passes its own ceiling")
    void anonymousCeilingEventuallyRefuses() throws Exception {
        when(valueOps.increment(anyString())).thenReturn((long) ANONYMOUS_LIMIT + 1);

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(write(WATCH_ZONES, "203.0.113.7", "fp-aaaaaaaa"), response, chain);

        assertThat(response.getStatus()).isEqualTo(429);
        assertThat(chain.getRequest()).isNull();
    }

    @Test
    @DisplayName("a signed-in account is refused once it passes the account ceiling")
    void accountCeilingRefuses() throws Exception {
        when(valueOps.increment(anyString())).thenReturn((long) ACCOUNT_LIMIT + 1);

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(signedIn(write(WATCH_ZONES, "203.0.113.7", "fp-a"), UUID.randomUUID()),
                response, chain);

        assertThat(response.getStatus()).isEqualTo(429);
        assertThat(chain.getRequest()).isNull();
    }

    private void allowRequests() {
        when(valueOps.increment(anyString())).thenReturn(2L);
    }

    private void send(MockHttpServletRequest request) throws Exception {
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());
    }

    /**
     * The trailing window number turns over on the minute, so assert on the
     * principal segment rather than the whole key.
     */
    private List<String> principals() {
        ArgumentCaptor<String> keys = ArgumentCaptor.forClass(String.class);
        verify(valueOps, atLeastOnce()).increment(keys.capture());
        return keys.getAllValues().stream()
                .map(key -> key.substring("rl:".length(), key.lastIndexOf(':')))
                .toList();
    }

    private static MockHttpServletRequest write(String uri, String forwardedFor, String fingerprint) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", uri);
        request.addHeader("X-Forwarded-For", forwardedFor);
        request.addHeader(ClientFingerprint.HEADER, fingerprint);
        return request;
    }

    private static MockHttpServletRequest signedIn(MockHttpServletRequest request, UUID userId) {
        request.setAttribute(AuthContext.ATTRIBUTE, new AuthUser(userId, "Sam"));
        return request;
    }
}
