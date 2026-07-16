package com.communityalerts.api.support;

import com.communityalerts.api.auth.AuthContext;
import com.communityalerts.api.auth.AuthUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

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
}
