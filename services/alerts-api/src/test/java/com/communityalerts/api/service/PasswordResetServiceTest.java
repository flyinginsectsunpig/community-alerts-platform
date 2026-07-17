package com.communityalerts.api.service;

import com.communityalerts.api.domain.PasswordResetToken;
import com.communityalerts.api.domain.User;
import com.communityalerts.api.error.UnauthorizedException;
import com.communityalerts.api.repository.PasswordResetTokenRepository;
import com.communityalerts.api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    private static final int TTL_MINUTES = 60;

    @Mock
    private UserRepository userRepository;
    @Mock
    private PasswordResetTokenRepository tokenRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private ResetEmailSender emailSender;

    private PasswordResetService service;

    @BeforeEach
    void setUp() {
        service = new PasswordResetService(
                userRepository, tokenRepository, passwordEncoder, emailSender,
                "http://localhost:3000", TTL_MINUTES);
    }

    private static User user(UUID id) {
        User user = new User();
        user.setId(id);
        user.setEmail("sam@example.com");
        user.setDisplayName("Sam");
        user.setPasswordHash("old-hash");
        return user;
    }

    @Test
    @DisplayName("requesting a reset for an unknown email does nothing, silently")
    void unknownEmailIsSilent() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        service.requestReset("Ghost@Example.com ");

        verify(tokenRepository, never()).save(any());
        verify(emailSender, never()).send(anyString(), anyString());
    }

    @Test
    @DisplayName("requesting a reset stores only a hash and mails a link with the raw token")
    void resetRequestStoresHashAndMailsLink() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findByEmail("sam@example.com")).thenReturn(Optional.of(user(userId)));
        when(tokenRepository.save(any(PasswordResetToken.class))).thenAnswer(inv -> inv.getArgument(0));

        service.requestReset("sam@example.com");

        ArgumentCaptor<PasswordResetToken> tokenCaptor =
                ArgumentCaptor.forClass(PasswordResetToken.class);
        verify(tokenRepository).save(tokenCaptor.capture());
        ArgumentCaptor<String> linkCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailSender).send(eq("sam@example.com"), linkCaptor.capture());

        String link = linkCaptor.getValue();
        assertThat(link).startsWith("http://localhost:3000/reset-password?token=");
        String rawToken = link.substring(link.indexOf("token=") + 6);

        PasswordResetToken stored = tokenCaptor.getValue();
        assertThat(stored.getUserId()).isEqualTo(userId);
        // The raw token must never be persisted — only its hash.
        assertThat(stored.getTokenHash()).isNotEqualTo(rawToken).hasSize(64);
        assertThat(stored.getExpiresAt())
                .isBetween(Instant.now().plusSeconds(59 * 60), Instant.now().plusSeconds(61 * 60));
    }

    @Test
    @DisplayName("a valid token re-hashes the password and is marked used")
    void validTokenResetsPassword() {
        UUID userId = UUID.randomUUID();
        PasswordResetToken row = new PasswordResetToken();
        row.setUserId(userId);
        row.setTokenHash(PasswordResetService.sha256Hex("the-raw-token"));
        row.setExpiresAt(Instant.now().plusSeconds(600));
        when(tokenRepository.findByTokenHash(PasswordResetService.sha256Hex("the-raw-token")))
                .thenReturn(Optional.of(row));
        User user = user(userId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("new-password-123")).thenReturn("new-hash");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(tokenRepository.save(any(PasswordResetToken.class))).thenAnswer(inv -> inv.getArgument(0));

        service.resetPassword("the-raw-token", "new-password-123");

        assertThat(user.getPasswordHash()).isEqualTo("new-hash");
        assertThat(row.getUsedAt()).isNotNull();
    }

    @Test
    @DisplayName("expired tokens are rejected")
    void expiredTokenRejected() {
        PasswordResetToken row = new PasswordResetToken();
        row.setUserId(UUID.randomUUID());
        row.setTokenHash(PasswordResetService.sha256Hex("stale-token"));
        row.setExpiresAt(Instant.now().minusSeconds(1));
        when(tokenRepository.findByTokenHash(PasswordResetService.sha256Hex("stale-token")))
                .thenReturn(Optional.of(row));

        assertThatThrownBy(() -> service.resetPassword("stale-token", "new-password-123"))
                .isInstanceOf(UnauthorizedException.class);
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("used tokens are rejected on reuse")
    void usedTokenRejected() {
        PasswordResetToken row = new PasswordResetToken();
        row.setUserId(UUID.randomUUID());
        row.setTokenHash(PasswordResetService.sha256Hex("spent-token"));
        row.setExpiresAt(Instant.now().plusSeconds(600));
        row.setUsedAt(Instant.now());
        when(tokenRepository.findByTokenHash(PasswordResetService.sha256Hex("spent-token")))
                .thenReturn(Optional.of(row));

        assertThatThrownBy(() -> service.resetPassword("spent-token", "new-password-123"))
                .isInstanceOf(UnauthorizedException.class);
        verify(userRepository, never()).save(any());
    }
}
