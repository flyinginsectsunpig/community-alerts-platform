package com.communityalerts.config;

/**
 * CORS configuration is handled by SecurityConfig.filterChain()
 * via Spring Security's .cors() DSL.
 *
 * This class is intentionally left empty — defining a separate CorsFilter
 * bean alongside Spring Security's built-in CORS support caused duplicate
 * CORS headers and a 500 on POST requests (e.g. /api/auth/login).
 *
 * DO NOT add @Configuration or any @Bean methods here.
 */
public final class CorsConfig {
    private CorsConfig() { /* utility class, no instantiation */ }
}
