package com.communityalerts.controller;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.communityalerts.model.User;
import com.communityalerts.repository.UserRepository;
import com.communityalerts.security.JwtTokenProvider;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Auth", description = "Login and JWT token management")
public class AuthController {

    private final UserRepository userRepository;
    private final JwtTokenProvider tokenProvider;
    private final PasswordEncoder passwordEncoder;

    @PostMapping("/login")
    @Operation(summary = "Authenticate and receive a JWT token")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            log.info("Login attempt for username: {}", request.username);

            User user = userRepository.findByUsername(request.username)
                    .orElse(null);

            if (user == null) {
                log.warn("Login failed: user '{}' not found", request.username);
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Invalid username or password"));
            }

            if (!passwordEncoder.matches(request.password, user.getPassword())) {
                log.warn("Login failed: invalid password for user '{}'", request.username);
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Invalid username or password"));
            }

            String role = user.getRole() != null ? user.getRole() : "ADMIN";
            String token = tokenProvider.generateToken(user.getUsername(), role);

            log.info("Login successful for user '{}' with role '{}'", user.getUsername(), role);

            return ResponseEntity.ok(Map.of(
                    "token", token,
                    "username", user.getUsername(),
                    "role", role
            ));
        } catch (Exception e) {
            log.error("Login error for user '{}': {}", request != null ? request.username : "null", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal server error: " + e.getMessage()));
        }
    }

    public static class LoginRequest {
        public String username;
        public String password;
    }
}
