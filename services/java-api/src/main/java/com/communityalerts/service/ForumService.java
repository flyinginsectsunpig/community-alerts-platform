package com.communityalerts.service;

import com.communityalerts.dto.ForumPostRequest;
import com.communityalerts.dto.ForumPostResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ForumService {
    ForumPostResponse createPost(String suburbId, ForumPostRequest request);
    Page<ForumPostResponse> getPosts(String suburbId, Pageable pageable);
    ForumPostResponse likePost(Long postId);
}
