package com.communityalerts.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;

import java.time.Instant;
import java.util.UUID;

/**
 * Read-only view of rows produced by the .NET alert-processor worker.
 */
@Entity
@Immutable
@Table(name = "notifications")
public class Notification {

    @Id
    private Long id;

    @Column(name = "watch_zone_id", nullable = false)
    private UUID watchZoneId;

    @Column(name = "alert_id", nullable = false)
    private UUID alertId;

    @Column(nullable = false, length = 24)
    private String kind;

    @Column(nullable = false, columnDefinition = "text")
    private String message;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public Long getId() { return id; }
    public UUID getWatchZoneId() { return watchZoneId; }
    public UUID getAlertId() { return alertId; }
    public String getKind() { return kind; }
    public String getMessage() { return message; }
    public Instant getCreatedAt() { return createdAt; }
}
