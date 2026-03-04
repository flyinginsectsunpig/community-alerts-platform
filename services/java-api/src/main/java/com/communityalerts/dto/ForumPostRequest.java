package com.communityalerts.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.Data;

@Data
public class ForumPostRequest {

    @NotBlank(message = "Username is required")
    @Size(min = 2, max = 50)
    private String username;

    @NotBlank(message = "Post text is required")
    @Size(min = 5, max = 2000)
    private String text;
}
