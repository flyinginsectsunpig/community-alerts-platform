package com.communityalerts.api.web;

import com.communityalerts.api.auth.AuthContext;
import com.communityalerts.api.domain.DigestFrequency;
import com.communityalerts.api.dto.AuthResponse;
import com.communityalerts.api.dto.LoginRequest;
import com.communityalerts.api.dto.ProfileResponse;
import com.communityalerts.api.dto.SignupRequest;
import com.communityalerts.api.service.AuthService;
import com.communityalerts.api.service.ProfileService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final ProfileService profileService;

    public AuthController(AuthService authService, ProfileService profileService) {
        this.authService = authService;
        this.profileService = profileService;
    }

    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.signup(request));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/profile")
    public ProfileResponse profile(HttpServletRequest httpRequest) {
        return profileService.profile(AuthContext.require(httpRequest).id());
    }

    public record UpdateProfileRequest(@NotNull DigestFrequency digestFrequency) {
    }

    @PatchMapping("/profile")
    public ProfileResponse updateProfile(@Valid @RequestBody UpdateProfileRequest request,
                                         HttpServletRequest httpRequest) {
        return profileService.updateDigestFrequency(
                AuthContext.require(httpRequest).id(), request.digestFrequency());
    }
}
