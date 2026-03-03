package com.communityalerts.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * A post in a suburb-specific community forum thread.
 */
@Entity
@Table(name = "forum_posts", indexes = {
    @Index(name = "idx_forum_suburb", columnList = "suburb_id"),
    @Index(name = "idx_forum_created", columnList = "createdAt")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ForumPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "suburb_id", nullable = false)
    private Suburb suburb;

    @Column(nullable = false, length = 50)
    private String username;

    @Column(nullable = false, length = 2000)
    private String text;

    @Builder.Default
    @Column(nullable = false)
    private Integer likes = 0;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
