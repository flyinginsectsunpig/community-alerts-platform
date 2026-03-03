package com.communityalerts.service;

import com.communityalerts.dto.CommentRequest;
import com.communityalerts.dto.CommentResponse;

import java.util.List;

public interface CommentService {
    CommentResponse addComment(Long incidentId, CommentRequest request);
    List<CommentResponse> getComments(Long incidentId);
}
