package com.communityalerts.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Core domain entity — a community-reported incident placed on the map.
 *
 * Reporter identity is intentionally NOT stored here.
 * The DTO layer ensures reporter metadata never leaks to the frontend.
 */
@Entity
@Table(name = "incidents", indexes = {
    @Index(name = "idx_incident_suburb", columnList = "suburb_id"),
    @Index(name = "idx_incident_type",   columnList = "type"),
    @Index(name = "idx_incident_created", columnList = "created_at"),
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Incident {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "suburb_id", nullable = false)
    private Suburb suburb;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private IncidentType type;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 2000)
    private String description;

    /**
     * Comma-separated suspect/vehicle tags extracted from the description.
     * e.g. "Blue hoodie,Silver Polo,CA 443 GP"
     * In a v2 these would be extracted by the Python NLP service.
     */
    @Column(length = 500)
    private String tags;

    /**
     * Reporter-assigned severity 1–5.
     * Used to weight the suburb heat score.
     */
    @Column(nullable = false)
    @Builder.Default
    private Integer severity = 3;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder.Default
    @OneToMany(mappedBy = "incident", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Comment> comments = new ArrayList<>();
}
