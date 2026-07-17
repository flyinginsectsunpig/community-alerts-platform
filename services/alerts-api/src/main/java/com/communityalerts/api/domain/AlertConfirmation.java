package com.communityalerts.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "alert_confirmations")
public class AlertConfirmation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "alert_id", nullable = false)
    private UUID alertId;

    @Column(nullable = false, length = 64)
    private String fingerprint;

    /** Null on confirmations recorded before accounts were required. */
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected AlertConfirmation() {
        // for JPA
    }

    public AlertConfirmation(UUID alertId, String fingerprint, UUID userId) {
        this.alertId = alertId;
        this.fingerprint = fingerprint;
        this.userId = userId;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() { return id; }
    public UUID getAlertId() { return alertId; }
    public String getFingerprint() { return fingerprint; }
    public UUID getUserId() { return userId; }
    public Instant getCreatedAt() { return createdAt; }
}
