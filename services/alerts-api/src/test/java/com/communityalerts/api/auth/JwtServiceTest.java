package com.communityalerts.api.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef";

    private final JwtService jwtService = new JwtService(SECRET, 60);

    @Test
    @DisplayName("issued tokens verify back to the same principal")
    void roundTrip() {
        UUID userId = UUID.randomUUID();

        JwtService.IssuedToken issued = jwtService.issue(userId, "Sammy");
        Optional<AuthUser> verified = jwtService.verify(issued.token());

        assertThat(verified).hasValueSatisfying(user -> {
            assertThat(user.id()).isEqualTo(userId);
            assertThat(user.displayName()).isEqualTo("Sammy");
        });
    }

    @Test
    @DisplayName("expired tokens are rejected")
    void expiredRejected() {
        JwtService expiredIssuer = new JwtService(SECRET, -1);
        String token = expiredIssuer.issue(UUID.randomUUID(), "Sammy").token();

        assertThat(jwtService.verify(token)).isEmpty();
    }

    @Test
    @DisplayName("tokens signed with a different key are rejected")
    void wrongKeyRejected() {
        JwtService other = new JwtService("another-secret-key-32-bytes-minimum!", 60);
        String token = other.issue(UUID.randomUUID(), "Sammy").token();

        assertThat(jwtService.verify(token)).isEmpty();
    }

    @Test
    @DisplayName("garbage and blank tokens are rejected, not thrown")
    void malformedRejected() {
        assertThat(jwtService.verify("not.a.jwt")).isEmpty();
        assertThat(jwtService.verify("")).isEmpty();
        assertThat(jwtService.verify(null)).isEmpty();
    }

    @Test
    @DisplayName("short signing keys are refused at startup")
    void shortSecretRefused() {
        assertThatThrownBy(() -> new JwtService("too-short", 60))
                .isInstanceOf(IllegalStateException.class);
    }
}
