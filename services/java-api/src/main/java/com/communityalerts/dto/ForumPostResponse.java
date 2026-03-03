package com.communityalerts.dto;

import java.time.LocalDateTime;

public record ForumPostResponse(
    Long id,
    String suburbId,
    String suburbName,
    String username,
    String text,
    Integer likes,
    LocalDateTime createdAt
) {}
