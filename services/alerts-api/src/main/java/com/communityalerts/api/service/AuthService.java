package com.communityalerts.api.service;

import com.communityalerts.api.auth.JwtService;
import com.communityalerts.api.domain.User;
import com.communityalerts.api.dto.AuthResponse;
import com.communityalerts.api.dto.LoginRequest;
import com.communityalerts.api.dto.SignupRequest;
import com.communityalerts.api.error.ConflictException;
import com.communityalerts.api.error.UnauthorizedException;
import com.communityalerts.api.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {

    /** One message for unknown email and wrong password — no user enumeration. */
    private static final String BAD_CREDENTIALS = "Invalid email or password";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse signup(SignupRequest request) {
        String email = normalizeEmail(request.email());
        if (userRepository.findByEmail(email).isPresent()) {
            throw new ConflictException("An account with this email already exists");
        }

        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail(email);
        user.setDisplayName(request.displayName().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        try {
            userRepository.save(user);
        } catch (DataIntegrityViolationException e) {
            // Unique-constraint race between the exists-check and the insert.
            throw new ConflictException("An account with this email already exists");
        }

        return issue(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(normalizeEmail(request.email()))
                .orElseThrow(() -> new UnauthorizedException(BAD_CREDENTIALS));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new UnauthorizedException(BAD_CREDENTIALS);
        }
        return issue(user);
    }

    private AuthResponse issue(User user) {
        JwtService.IssuedToken issued = jwtService.issue(user.getId(), user.getDisplayName());
        return new AuthResponse(
                issued.token(), user.getId(), user.getDisplayName(), user.getEmail(), issued.expiresAt());
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
