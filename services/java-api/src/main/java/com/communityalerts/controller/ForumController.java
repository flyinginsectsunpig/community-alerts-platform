package com.communityalerts.controller;

import com.communityalerts.dto.ForumPostRequest;
import com.communityalerts.dto.ForumPostResponse;
import com.communityalerts.service.ForumService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/forum")
@RequiredArgsConstructor
@Tag(name = "Forum", description = "Suburb-specific community discussion boards")
public class ForumController {

    private final ForumService forumService;

    @PostMapping("/suburbs/{suburbId}/posts")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a new forum post in a suburb")
    public ForumPostResponse createPost(
        @PathVariable String suburbId,
        @Valid @RequestBody ForumPostRequest request
    ) {
        return forumService.createPost(suburbId, request);
    }

    @GetMapping("/suburbs/{suburbId}/posts")
    @Operation(summary = "Get forum posts for a suburb (paginated, newest first)")
    public Page<ForumPostResponse> getPosts(
        @PathVariable String suburbId,
        @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
        Pageable pageable
    ) {
        return forumService.getPosts(suburbId, pageable);
    }

    @PostMapping("/posts/{postId}/like")
    @Operation(summary = "Like a forum post")
    public ForumPostResponse likePost(@PathVariable Long postId) {
        return forumService.likePost(postId);
    }
}
