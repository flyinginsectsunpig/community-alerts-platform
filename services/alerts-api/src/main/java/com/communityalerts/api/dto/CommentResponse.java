package com.communityalerts.api.dto;

import com.communityalerts.api.repository.AlertCommentRepository.CommentRow;

import java.time.Instant;
import java.util.UUID;

public record CommentResponse(
        Long id,
        UUID alertId,
        UUID authorId,
        String authorName,
        String body,
        Instant createdAt) {

    public static CommentResponse from(CommentRow row) {
        return new CommentResponse(
                row.getId(),
                row.getAlertId(),
                row.getAuthorId(),
                row.getAuthorName(),
                row.getBody(),
                row.getCreatedAt());
    }
}
