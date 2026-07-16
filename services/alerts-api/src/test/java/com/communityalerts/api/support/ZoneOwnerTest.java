package com.communityalerts.api.support;

import com.communityalerts.api.auth.AuthContext;
import com.communityalerts.api.auth.AuthUser;
import com.communityalerts.api.error.BadRequestException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ZoneOwnerTest {

    @Test
    @DisplayName("resolve prefers the authenticated user and carries no fingerprint")
    void resolveAuthenticated() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        UUID userId = UUID.randomUUID();
        request.setAttribute(AuthContext.ATTRIBUTE, new AuthUser(userId, "Sam"));
        request.addHeader(ClientFingerprint.HEADER, "fp-123");

        ZoneOwner owner = ZoneOwner.resolve(request);

        assertThat(owner.userId()).isEqualTo(userId);
        assertThat(owner.fingerprint()).isNull();
        assertThat(owner.isAuthenticated()).isTrue();
    }

    @Test
    @DisplayName("resolve falls back to the client fingerprint when anonymous")
    void resolveAnonymous() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(ClientFingerprint.HEADER, "fp-123");

        ZoneOwner owner = ZoneOwner.resolve(request);

        assertThat(owner.userId()).isNull();
        assertThat(owner.fingerprint()).isEqualTo("fp-123");
        assertThat(owner.isAuthenticated()).isFalse();
    }

    @Test
    @DisplayName("constructing with both or neither owner marker is rejected")
    void invariantEnforced() {
        assertThatThrownBy(() -> new ZoneOwner(null, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ZoneOwner(UUID.randomUUID(), "fp-123"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("anonymous resolution without a fingerprint header is refused")
    void resolveAnonymousWithoutHeaderRefused() {
        MockHttpServletRequest request = new MockHttpServletRequest();

        assertThatThrownBy(() -> ZoneOwner.resolve(request))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("a header imitating the ip- fallback is refused as a zone owner")
    void resolveSpoofedIpFallbackRefused() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(ClientFingerprint.HEADER, "ip-deadbeef");

        assertThatThrownBy(() -> ZoneOwner.resolve(request))
                .isInstanceOf(BadRequestException.class);
    }
}
