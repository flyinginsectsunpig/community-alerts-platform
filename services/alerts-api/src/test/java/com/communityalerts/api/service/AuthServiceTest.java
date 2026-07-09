package com.communityalerts.api.service;

import com.communityalerts.api.auth.JwtService;
import com.communityalerts.api.domain.User;
import com.communityalerts.api.dto.AuthResponse;
import com.communityalerts.api.dto.LoginRequest;
import com.communityalerts.api.dto.SignupRequest;
import com.communityalerts.api.error.ConflictException;
import com.communityalerts.api.error.UnauthorizedException;
import com.communityalerts.api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final String SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef";

    @Mock
    private UserRepository userRepository;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final JwtService jwtService = new JwtService(SECRET, 60);

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, passwordEncoder, jwtService);
    }

    @Test
    @DisplayName("signup stores a bcrypt hash, never the raw password")
    void signupHashesPassword() {
        when(userRepository.findByEmail("sammy@example.com")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        AuthResponse response = authService.signup(
                new SignupRequest("Sammy@Example.com", "Sammy", "correct horse battery"));

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        User saved = captor.getValue();

        assertThat(saved.getEmail()).isEqualTo("sammy@example.com"); // normalized
        assertThat(saved.getPasswordHash()).doesNotContain("correct horse battery");
        assertThat(passwordEncoder.matches("correct horse battery", saved.getPasswordHash())).isTrue();
        assertThat(response.token()).isNotBlank();
        assertThat(jwtService.verify(response.token())).isPresent();
    }

    @Test
    @DisplayName("duplicate email is a conflict")
    void duplicateEmailConflicts() {
        when(userRepository.findByEmail("sammy@example.com"))
                .thenReturn(Optional.of(new User()));

        assertThatThrownBy(() -> authService.signup(
                new SignupRequest("sammy@example.com", "Sammy", "password123")))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("login succeeds with the right password")
    void loginSucceeds() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("sammy@example.com");
        user.setDisplayName("Sammy");
        user.setPasswordHash(passwordEncoder.encode("password123"));
        when(userRepository.findByEmail("sammy@example.com")).thenReturn(Optional.of(user));

        AuthResponse response = authService.login(new LoginRequest("sammy@example.com", "password123"));

        assertThat(response.userId()).isEqualTo(user.getId());
        assertThat(jwtService.verify(response.token())).isPresent();
    }

    @Test
    @DisplayName("wrong password and unknown email fail with the same message")
    void badCredentialsIndistinguishable() {
        User user = new User();
        user.setPasswordHash(passwordEncoder.encode("password123"));
        when(userRepository.findByEmail("sammy@example.com")).thenReturn(Optional.of(user));
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        Throwable wrongPassword = catchUnauthorized("sammy@example.com", "wrong-password");
        Throwable unknownEmail = catchUnauthorized("ghost@example.com", "password123");

        assertThat(wrongPassword.getMessage()).isEqualTo(unknownEmail.getMessage());
    }

    private Throwable catchUnauthorized(String email, String password) {
        try {
            authService.login(new LoginRequest(email, password));
            throw new AssertionError("expected UnauthorizedException");
        } catch (UnauthorizedException e) {
            return e;
        }
    }
}
