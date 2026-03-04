package com.communityalerts.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.Data;

@Data
public class CommentRequest {

    @NotBlank(message = "Username is required")
    @Size(min = 2, max = 50, message = "Username must be between 2 and 50 characters")
    private String username;

    @NotBlank(message = "Comment text is required")
    @Size(min = 2, max = 1000, message = "Comment must be between 2 and 1000 characters")
    private String text;

    private Boolean descriptionMatch;
}
