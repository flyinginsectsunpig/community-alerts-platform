package com.communityalerts.api.web;

import com.communityalerts.api.auth.AuthContext;
import com.communityalerts.api.dto.CommentResponse;
import com.communityalerts.api.dto.CreateCommentRequest;
import com.communityalerts.api.service.CommentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/alerts/{alertId}/comments")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    /** Threads are publicly readable — witnesses benefit even when signed out. */
    @GetMapping
    public List<CommentResponse> thread(@PathVariable UUID alertId) {
        return commentService.thread(alertId);
    }

    /** Posting requires an account (hybrid auth model). */
    @PostMapping
    public ResponseEntity<CommentResponse> add(@PathVariable UUID alertId,
                                               @Valid @RequestBody CreateCommentRequest request,
                                               HttpServletRequest httpRequest) {
        CommentResponse created = commentService.add(
                alertId, AuthContext.require(httpRequest), request.body());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
