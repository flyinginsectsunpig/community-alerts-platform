package com.communityalerts.api.service;

import com.communityalerts.api.auth.AuthUser;
import com.communityalerts.api.config.RedisPubSubConfig;
import com.communityalerts.api.domain.Alert;
import com.communityalerts.api.domain.AlertComment;
import com.communityalerts.api.dto.CommentResponse;
import com.communityalerts.api.error.NotFoundException;
import com.communityalerts.api.repository.AlertCommentRepository;
import com.communityalerts.api.repository.AlertRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class CommentService {

    private static final Logger log = LoggerFactory.getLogger(CommentService.class);

    private final AlertCommentRepository commentRepository;
    private final AlertRepository alertRepository;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public CommentService(AlertCommentRepository commentRepository,
                          AlertRepository alertRepository,
                          StringRedisTemplate redis,
                          ObjectMapper objectMapper) {
        this.commentRepository = commentRepository;
        this.alertRepository = alertRepository;
        this.redis = redis;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<CommentResponse> thread(UUID alertId) {
        requireAlert(alertId);
        return commentRepository.findThread(alertId).stream()
                .map(CommentResponse::from)
                .toList();
    }

    @Transactional
    public CommentResponse add(UUID alertId, AuthUser author, String body) {
        Alert alert = requireAlert(alertId);

        AlertComment saved = commentRepository.save(
                new AlertComment(alertId, author.id(), body.trim()));
        alert.setCommentCount(alert.getCommentCount() + 1);
        alertRepository.save(alert);

        CommentResponse response = new CommentResponse(
                saved.getId(), alertId, author.id(), author.displayName(),
                saved.getBody(), saved.getCreatedAt());
        publishLive(response, alert.getCommentCount());
        return response;
    }

    private Alert requireAlert(UUID alertId) {
        return alertRepository.findById(alertId)
                .orElseThrow(() -> new NotFoundException("Alert %s not found".formatted(alertId)));
    }

    private void publishLive(CommentResponse comment, int commentCount) {
        try {
            redis.convertAndSend(RedisPubSubConfig.LIVE_CHANNEL,
                    objectMapper.writeValueAsString(
                            new CommentLiveEvent("comment.created", comment.alertId(), commentCount, comment)));
        } catch (Exception e) {
            log.warn("Failed to publish live comment event for alert {}", comment.alertId(), e);
        }
    }

    public record CommentLiveEvent(String type, UUID alertId, int commentCount, CommentResponse comment) {
    }
}
