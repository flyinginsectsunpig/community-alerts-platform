package com.communityalerts.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * Application user for JWT authentication.
 * Supports ADMIN and MODERATOR roles.
 */
@Entity
@Table(name = "app_users")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String password;   // BCrypt-hashed

    @Column(nullable = false)
    @Builder.Default
    private String role = "ADMIN";   // ADMIN or MODERATOR
}
