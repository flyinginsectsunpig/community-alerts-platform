package com.communityalerts.api.auth;

import com.communityalerts.api.error.UnauthorizedException;
import jakarta.servlet.http.HttpServletRequest;

import java.util.Optional;

public final class AuthContext {

    public static final String ATTRIBUTE = "communityalerts.authUser";

    private AuthContext() {
    }

    public static Optional<AuthUser> optional(HttpServletRequest request) {
        return Optional.ofNullable((AuthUser) request.getAttribute(ATTRIBUTE));
    }

    public static AuthUser require(HttpServletRequest request) {
        return optional(request)
                .orElseThrow(() -> new UnauthorizedException("Sign in to do this"));
    }
}
