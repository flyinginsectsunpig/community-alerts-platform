package com.communityalerts.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import lombok.RequiredArgsConstructor;

/**
 * Spring Security configuration — stateless JWT authentication.
 *
 * Public endpoints (no auth required): - All GET requests on /api/v1/** (public
 * map/suburb/incident reads) - POST /api/auth/** (login) - Swagger UI / API
 * docs
 *
 * Protected endpoints (JWT required): - POST/PUT/DELETE on /api/admin/** →
 * ADMIN role - DELETE incidents/comments → ADMIN or MODERATOR
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable()) // stateless API — no CSRF needed
                .cors(cors -> cors.configurationSource(request -> {
            var config = new org.springframework.web.cors.CorsConfiguration();
            String extraOrigins = System.getenv("CORS_ALLOWED_ORIGINS");
            java.util.List<String> origins = new java.util.ArrayList<>(java.util.List.of("http://localhost:3000", "https://communityalerts.local"));
            if (extraOrigins != null && !extraOrigins.isBlank()) {
                for (String o : extraOrigins.split(",")) {
                    String trimmed = o.trim();
                    if (!trimmed.isEmpty()) {
                        origins.add(trimmed);
                    }
                }
            }
            config.setAllowedOrigins(origins);
            config.setAllowedMethods(java.util.List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
            config.setAllowedHeaders(java.util.List.of("Authorization", "Content-Type"));
            config.setExposedHeaders(java.util.List.of("Authorization"));
            config.setAllowCredentials(true);
            return config;
        }))
                .headers(headers -> headers
                .frameOptions(frame -> frame.deny())
                .xssProtection(xss -> xss.disable()) // Handled by Next.js/React frontend
                .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'self'"))
                )
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                // Public: authentication endpoints
                .requestMatchers("/api/auth/**").permitAll()
                // Public: all GET reads (map overlay, suburb list, incidents, forum)
                .requestMatchers(HttpMethod.GET, "/api/**").permitAll()
                // Public: Swagger / OpenAPI docs
                .requestMatchers("/swagger-ui/**", "/api-docs/**", "/swagger-ui.html").permitAll()
                // Public: POST incidents and comments (community reporting is open)
                .requestMatchers(HttpMethod.POST, "/api/v1/incidents").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/incidents/*/comments").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/forum").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/forum/*/comments").permitAll()
                // Protected: admin endpoints (upload, etc.)
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                // Protected: delete operations
                .requestMatchers(HttpMethod.DELETE, "/api/**").hasAnyRole("ADMIN", "MODERATOR")
                // Everything else requires authentication
                .anyRequest().authenticated()
                )
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
