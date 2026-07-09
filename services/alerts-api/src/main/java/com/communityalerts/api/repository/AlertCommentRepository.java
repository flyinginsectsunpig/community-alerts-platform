package com.communityalerts.api.repository;

import com.communityalerts.api.domain.AlertComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface AlertCommentRepository extends JpaRepository<AlertComment, Long> {

    interface CommentRow {
        Long getId();
        UUID getAlertId();
        UUID getAuthorId();
        String getAuthorName();
        String getBody();
        Instant getCreatedAt();
    }

    @Query("""
            SELECT c.id AS id, c.alertId AS alertId, u.id AS authorId,
                   u.displayName AS authorName, c.body AS body, c.createdAt AS createdAt
            FROM AlertComment c JOIN User u ON u.id = c.userId
            WHERE c.alertId = :alertId
            ORDER BY c.createdAt ASC
            """)
    List<CommentRow> findThread(@Param("alertId") UUID alertId);
}
