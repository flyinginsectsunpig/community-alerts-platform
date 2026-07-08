package com.communityalerts.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "watch_zones")
public class WatchZone {

    @Id
    private UUID id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "contact_email", nullable = false, length = 254)
    private String contactEmail;

    @Column(name = "center_lat", nullable = false)
    private double centerLat;

    @Column(name = "center_lng", nullable = false)
    private double centerLng;

    @Column(name = "radius_m", nullable = false)
    private int radiusM;

    /** CSV of {@link AlertCategory} names; empty string means all categories. */
    @Column(name = "categories", nullable = false, length = 512)
    private String categoriesCsv = "";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getContactEmail() { return contactEmail; }
    public void setContactEmail(String contactEmail) { this.contactEmail = contactEmail; }

    public double getCenterLat() { return centerLat; }
    public void setCenterLat(double centerLat) { this.centerLat = centerLat; }

    public double getCenterLng() { return centerLng; }
    public void setCenterLng(double centerLng) { this.centerLng = centerLng; }

    public int getRadiusM() { return radiusM; }
    public void setRadiusM(int radiusM) { this.radiusM = radiusM; }

    public String getCategoriesCsv() { return categoriesCsv; }
    public void setCategoriesCsv(String categoriesCsv) { this.categoriesCsv = categoriesCsv; }

    public Instant getCreatedAt() { return createdAt; }
}
