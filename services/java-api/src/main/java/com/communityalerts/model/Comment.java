package com.communityalerts.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * A community comment on an incident.
 * descriptionMatch is flagged true when the commenter confirms they saw
 * someone matching the suspect description — highlighted in the UI.
 */
@Entity
@Table(name = "comments", indexes = {
    @Index(name = "idx_comment_incident", columnList = "incident_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Comment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "incident_id", nullable = false)
    private Incident incident;

    @Column(nullable = false, length = 50)
    private String username;

    @Column(nullable = false, length = 1000)
    private String text;

    /**
     * True when the commenter explicitly indicates they saw
     * someone/something matching the incident description.
     */
    @Builder.Default
    @Column(nullable = false)
    private Boolean descriptionMatch = false;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
