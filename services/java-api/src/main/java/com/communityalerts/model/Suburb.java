package com.communityalerts.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * Represents a Cape Town suburb.
 * The heatScore is recalculated by HeatScoreService and stored
 * here for fast retrieval without re-scanning all incidents on every request.
 */
@Entity
@Table(name = "suburbs")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Suburb {

    @Id
    @Column(length = 50)
    private String id;          // e.g. "khaye", "mitch"

    @Column(nullable = false, length = 100)
    private String name;        // e.g. "Khayelitsha"

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    /**
     * Weighted score calculated from recent incidents.
     * Green < 12 | Yellow 12–19 | Orange 20–29 | Red >= 30
     */
    @Builder.Default
    @Column(nullable = false)
    private Integer heatScore = 0;
}
