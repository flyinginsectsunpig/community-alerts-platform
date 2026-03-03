package com.communityalerts.controller;

import com.communityalerts.dto.CommentRequest;
import com.communityalerts.dto.CommentResponse;
import com.communityalerts.service.CommentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/incidents/{incidentId}/comments")
@RequiredArgsConstructor
@Tag(name = "Comments", description = "Community sightings and updates on incidents")
public class CommentController {

    private final CommentService  commentService;
    private final RateLimitFilter rateLimitFilter;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Add a comment to an incident",
               description = "Set descriptionMatch=true if you spotted someone " +
                             "matching the suspect description.")
    public CommentResponse addComment(
        @PathVariable Long incidentId,
        @Valid @RequestBody CommentRequest request,
        HttpServletRequest httpRequest
    ) {
        rateLimitFilter.checkCommentLimit(httpRequest.getRemoteAddr());
        return commentService.addComment(incidentId, request);
    }

    @GetMapping
    @Operation(summary = "Get all comments for an incident, oldest first")
    public List<CommentResponse> getComments(@PathVariable Long incidentId) {
        return commentService.getComments(incidentId);
    }
}
