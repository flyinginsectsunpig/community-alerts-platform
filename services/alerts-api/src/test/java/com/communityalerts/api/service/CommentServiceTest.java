package com.communityalerts.api.service;

import com.communityalerts.api.auth.AuthUser;
import com.communityalerts.api.domain.Alert;
import com.communityalerts.api.domain.AlertCategory;
import com.communityalerts.api.domain.AlertComment;
import com.communityalerts.api.dto.CommentResponse;
import com.communityalerts.api.error.NotFoundException;
import com.communityalerts.api.repository.AlertCommentRepository;
import com.communityalerts.api.repository.AlertRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CommentServiceTest {

    @Mock
    private AlertCommentRepository commentRepository;
    @Mock
    private AlertRepository alertRepository;
    @Mock
    private StringRedisTemplate redis;

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    private CommentService commentService;

    @BeforeEach
    void setUp() {
        commentService = new CommentService(commentRepository, alertRepository, redis, objectMapper);
    }

    private Alert alertWith(UUID id, int commentCount) {
        Alert alert = new Alert();
        alert.setId(id);
        alert.setCategory(AlertCategory.THEFT);
        alert.setDescription("Bike stolen outside the library");
        alert.setCommentCount(commentCount);
        return alert;
    }

    @Test
    @DisplayName("adding a comment increments the count and publishes a live event")
    void addCommentPublishesLiveEvent() {
        UUID alertId = UUID.randomUUID();
        Alert alert = alertWith(alertId, 2);
        AuthUser author = new AuthUser(UUID.randomUUID(), "Sammy");
        when(alertRepository.findById(alertId)).thenReturn(Optional.of(alert));
        when(commentRepository.save(any(AlertComment.class))).thenAnswer(inv -> inv.getArgument(0));
        when(alertRepository.save(any(Alert.class))).thenAnswer(inv -> inv.getArgument(0));

        CommentResponse response = commentService.add(alertId, author, "  He wore a yellow sweater  ");

        assertThat(response.body()).isEqualTo("He wore a yellow sweater"); // trimmed
        assertThat(response.authorName()).isEqualTo("Sammy");
        assertThat(alert.getCommentCount()).isEqualTo(3);

        ArgumentCaptor<String> payload = ArgumentCaptor.forClass(String.class);
        verify(redis).convertAndSend(eq("alerts.live"), payload.capture());
        assertThat(payload.getValue()).contains("comment.created").contains("yellow sweater");
    }

    @Test
    @DisplayName("commenting on a missing alert is a 404")
    void unknownAlertRejected() {
        UUID alertId = UUID.randomUUID();
        when(alertRepository.findById(alertId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> commentService.add(
                alertId, new AuthUser(UUID.randomUUID(), "Sammy"), "body text"))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("thread lookup on a missing alert is a 404")
    void threadForUnknownAlertRejected() {
        UUID alertId = UUID.randomUUID();
        when(alertRepository.findById(alertId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> commentService.thread(alertId))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("a live-feed outage never fails the comment write")
    void livePublishFailureIsSwallowed() {
        UUID alertId = UUID.randomUUID();
        when(alertRepository.findById(alertId)).thenReturn(Optional.of(alertWith(alertId, 0)));
        when(commentRepository.save(any(AlertComment.class))).thenAnswer(inv -> inv.getArgument(0));
        when(alertRepository.save(any(Alert.class))).thenAnswer(inv -> inv.getArgument(0));
        org.mockito.Mockito.doThrow(new org.springframework.data.redis.RedisConnectionFailureException("down"))
                .when(redis).convertAndSend(anyString(), anyString());

        CommentResponse response = commentService.add(
                alertId, new AuthUser(UUID.randomUUID(), "Sammy"), "still works");

        assertThat(response.body()).isEqualTo("still works");
    }
}
