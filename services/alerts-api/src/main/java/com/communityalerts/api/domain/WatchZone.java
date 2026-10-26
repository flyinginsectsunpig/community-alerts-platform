package com.communityalerts.api.domain;

import com.communityalerts.api.dto.ZonePoint;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "watch_zones")
public class WatchZone {

    @Id
    private UUID id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "contact_email", length = 254)
    private String contactEmail;

    @Column(name = "center_lat", nullable = false)
    private double centerLat;

    @Column(name = "center_lng", nullable = false)
    private double centerLng;

    @Column(name = "radius_m", nullable = false)
    private int radiusM;

    /** Drawn outline; null for a circle zone. Always set together with {@link #shape}. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "polygon")
    private List<ZonePoint> polygon;

    /** Client-owned description of the drawn shape, opaque to the API; null for a circle zone. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "shape")
    private JsonNode shape;

    /** CSV of {@link AlertCategory} names; empty string means all categories. */
    @Column(name = "categories", nullable = false, length = 512)
    private String categoriesCsv = "";

    /** Set when the zone was created by a signed-in user; null for anonymous. */
    @Column(name = "user_id")
    private UUID userId;

    /** Set when the zone was created anonymously; null once claimed or when created signed-in. */
    @Column(name = "owner_fingerprint", length = 64)
    private String ownerFingerprint;

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

    public List<ZonePoint> getPolygon() { return polygon; }
    public void setPolygon(List<ZonePoint> polygon) { this.polygon = polygon; }

    public JsonNode getShape() { return shape; }
    public void setShape(JsonNode shape) { this.shape = shape; }

    public String getCategoriesCsv() { return categoriesCsv; }
    public void setCategoriesCsv(String categoriesCsv) { this.categoriesCsv = categoriesCsv; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getOwnerFingerprint() { return ownerFingerprint; }
    public void setOwnerFingerprint(String ownerFingerprint) { this.ownerFingerprint = ownerFingerprint; }

    public Instant getCreatedAt() { return createdAt; }
}
