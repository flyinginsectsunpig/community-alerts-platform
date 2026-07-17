package com.communityalerts.api.service;

import com.communityalerts.api.domain.PasswordResetToken;
import com.communityalerts.api.domain.User;
import com.communityalerts.api.error.UnauthorizedException;
import com.communityalerts.api.repository.PasswordResetTokenRepository;
import com.communityalerts.api.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;

@Service
public class PasswordResetService {

    /** One message for every failure mode — a token probe learns nothing. */
    private static final String BAD_TOKEN = "This reset link is invalid or has expired";

    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final ResetEmailSender emailSender;
    private final String webBaseUrl;
    private final Duration tokenTtl;

    public PasswordResetService(UserRepository userRepository,
                                PasswordResetTokenRepository tokenRepository,
                                PasswordEncoder passwordEncoder,
                                ResetEmailSender emailSender,
                                @Value("${app.web.base-url}") String webBaseUrl,
                                @Value("${app.auth.reset-token-ttl-minutes}") int tokenTtlMinutes) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailSender = emailSender;
        this.webBaseUrl = webBaseUrl;
        this.tokenTtl = Duration.ofMinutes(tokenTtlMinutes);
    }

    /** Always succeeds from the caller's perspective — no user enumeration. */
    @Transactional
    public void requestReset(String rawEmail) {
        userRepository.findByEmail(rawEmail.trim().toLowerCase(Locale.ROOT)).ifPresent(user -> {
            byte[] bytes = new byte[32];
            RANDOM.nextBytes(bytes);
            String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

            PasswordResetToken row = new PasswordResetToken();
            row.setUserId(user.getId());
            row.setTokenHash(sha256Hex(token));
            row.setExpiresAt(Instant.now().plus(tokenTtl));
            tokenRepository.save(row);

            emailSender.send(user.getEmail(), webBaseUrl + "/reset-password?token=" + token);
        });
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        PasswordResetToken row = tokenRepository.findByTokenHash(sha256Hex(token))
                .filter(t -> t.getUsedAt() == null && t.getExpiresAt().isAfter(Instant.now()))
                .orElseThrow(() -> new UnauthorizedException(BAD_TOKEN));

        User user = userRepository.findById(row.getUserId())
                .orElseThrow(() -> new UnauthorizedException(BAD_TOKEN));
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        row.setUsedAt(Instant.now());
        userRepository.save(user);
        tokenRepository.save(row);
    }

    static String sha256Hex(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
