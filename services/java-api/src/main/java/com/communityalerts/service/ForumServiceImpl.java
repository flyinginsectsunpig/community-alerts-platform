package com.communityalerts.service;

import com.communityalerts.dto.ForumPostRequest;
import com.communityalerts.dto.ForumPostResponse;
import com.communityalerts.model.ForumPost;
import com.communityalerts.model.Suburb;
import com.communityalerts.repository.ForumPostRepository;
import com.communityalerts.repository.SuburbRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ForumServiceImpl implements ForumService {

    private final ForumPostRepository forumPostRepository;
    private final SuburbRepository    suburbRepository;

    @Override
    @Transactional
    public ForumPostResponse createPost(String suburbId, ForumPostRequest request) {
        Suburb suburb = suburbRepository.findById(suburbId)
            .orElseThrow(() -> new EntityNotFoundException("Suburb not found: " + suburbId));

        ForumPost post = ForumPost.builder()
            .suburb(suburb)
            .username(request.username())
            .text(request.text())
            .build();

        return toResponse(forumPostRepository.save(post));
    }

    @Override
    public Page<ForumPostResponse> getPosts(String suburbId, Pageable pageable) {
        if (!suburbRepository.existsById(suburbId)) {
            throw new EntityNotFoundException("Suburb not found: " + suburbId);
        }
        return forumPostRepository
            .findBySuburbIdOrderByCreatedAtDesc(suburbId, pageable)
            .map(this::toResponse);
    }

    @Override
    @Transactional
    public ForumPostResponse likePost(Long postId) {
        ForumPost post = forumPostRepository.findById(postId)
            .orElseThrow(() -> new EntityNotFoundException("Post not found: " + postId));
        post.setLikes(post.getLikes() + 1);
        return toResponse(forumPostRepository.save(post));
    }

    private ForumPostResponse toResponse(ForumPost p) {
        return new ForumPostResponse(
            p.getId(),
            p.getSuburb().getId(),
            p.getSuburb().getName(),
            p.getUsername(),
            p.getText(),
            p.getLikes(),
            p.getCreatedAt()
        );
    }
}
