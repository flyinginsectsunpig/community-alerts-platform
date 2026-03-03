package com.communityalerts.dto;

import java.time.LocalDateTime;

public record CommentResponse(
    Long id,
    Long incidentId,
    String username,
    String text,
    Boolean descriptionMatch,
    LocalDateTime createdAt
) {}
