package com.communityalerts.api.service;

import com.communityalerts.api.domain.Alert;
import com.communityalerts.api.domain.AlertCategory;
import com.communityalerts.api.domain.AlertStatus;
import com.communityalerts.api.domain.Severity;
import com.communityalerts.api.dto.AlertResponse;
import com.communityalerts.api.dto.CreateAlertRequest;
import com.communityalerts.api.error.ConflictException;
import com.communityalerts.api.error.NotFoundException;
import com.communityalerts.api.messaging.AlertEventPublisher;
import com.communityalerts.api.messaging.events.AlertCreatedEvent;
import com.communityalerts.api.repository.AlertConfirmationRepository;
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
import org.springframework.data.redis.core.ValueOperations;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AlertServiceTest {

    private static final int VERIFY_THRESHOLD = 3;
    private static final long NEARBY_TTL_SECONDS = 30;

    @Mock
    private AlertRepository alertRepository;
    @Mock
    private AlertConfirmationRepository confirmationRepository;
    @Mock
    private AlertEventPublisher eventPublisher;
    @Mock
    private StringRedisTemplate redis;
    @Mock
    private ValueOperations<String, String> valueOperations;

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    private AlertService alertService;

    @BeforeEach
    void setUp() {
        alertService = new AlertService(
                alertRepository,
                confirmationRepository,
                eventPublisher,
                redis,
                objectMapper,
                VERIFY_THRESHOLD,
                NEARBY_TTL_SECONDS);
    }

    private Alert persistedAlert(UUID id, String reporterFingerprint) {
        Alert alert = new Alert();
        alert.setId(id);
        alert.setCategory(AlertCategory.THEFT);
        alert.setDescription("Bike stolen from outside the library");
        alert.setLat(51.5074);
        alert.setLng(-0.1278);
        alert.setReporterFingerprint(reporterFingerprint);
        alert.setCreatedAt(Instant.now());
        alert.setUpdatedAt(Instant.now());
        return alert;
    }

    @Test
    @DisplayName("create persists the alert and publishes alert.created")
    void createPublishesEvent() {
        when(alertRepository.save(any(Alert.class))).thenAnswer(invocation -> {
            Alert alert = invocation.getArgument(0);
            alert.setCreatedAt(Instant.now());
            alert.setUpdatedAt(Instant.now());
            return alert;
        });

        CreateAlertRequest request = new CreateAlertRequest(
                AlertCategory.THEFT, "Bike stolen from outside the library", 51.5074, -0.1278);

        AlertResponse response = alertService.create(request, "reporter-1");

        assertThat(response.id()).isNotNull();
        assertThat(response.severity()).isEqualTo(Severity.UNSCORED);
        assertThat(response.status()).isEqualTo(AlertStatus.ACTIVE);

        ArgumentCaptor<AlertCreatedEvent> eventCaptor = ArgumentCaptor.forClass(AlertCreatedEvent.class);
        verify(eventPublisher).publishAlertCreated(eventCaptor.capture());
        assertThat(eventCaptor.getValue().alertId()).isEqualTo(response.id());
        assertThat(eventCaptor.getValue().category()).isEqualTo("THEFT");

        verify(redis).convertAndSend(eq("alerts.live"), anyString());
    }

    @Test
    @DisplayName("applySeverity updates the stored alert and pushes a live update")
    void applySeverityUpdatesAlert() {
        UUID id = UUID.randomUUID();
        Alert alert = persistedAlert(id, "reporter-1");
        when(alertRepository.findById(id)).thenReturn(Optional.of(alert));
        when(alertRepository.save(any(Alert.class))).thenAnswer(inv -> inv.getArgument(0));

        AlertResponse response = alertService.applySeverity(id, Severity.HIGH, 0.72, "model-1");

        assertThat(response.severity()).isEqualTo(Severity.HIGH);
        assertThat(response.riskScore()).isEqualTo(0.72);
        verify(redis).convertAndSend(eq("alerts.live"), anyString());
    }

    @Test
    @DisplayName("applySeverity for an unknown alert throws NotFoundException")
    void applySeverityUnknownAlert() {
        UUID id = UUID.randomUUID();
        when(alertRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> alertService.applySeverity(id, Severity.LOW, 0.1, "model-1"))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("confirm reaching the threshold flips the alert to VERIFIED")
    void confirmReachingThresholdVerifies() {
        UUID id = UUID.randomUUID();
        Alert alert = persistedAlert(id, "reporter-1");
        alert.setConfirmationCount(VERIFY_THRESHOLD - 1);
        when(alertRepository.findById(id)).thenReturn(Optional.of(alert));
        when(confirmationRepository.existsByAlertIdAndFingerprint(id, "other-user")).thenReturn(false);
        when(alertRepository.save(any(Alert.class))).thenAnswer(inv -> inv.getArgument(0));

        AlertResponse response = alertService.confirm(id, "other-user");

        assertThat(response.confirmationCount()).isEqualTo(VERIFY_THRESHOLD);
        assertThat(response.status()).isEqualTo(AlertStatus.VERIFIED);
        verify(confirmationRepository).save(any());
    }

    @Test
    @DisplayName("reporters cannot confirm their own alert")
    void confirmOwnReportRejected() {
        UUID id = UUID.randomUUID();
        Alert alert = persistedAlert(id, "reporter-1");
        when(alertRepository.findById(id)).thenReturn(Optional.of(alert));

        assertThatThrownBy(() -> alertService.confirm(id, "reporter-1"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("own report");
        verify(confirmationRepository, never()).save(any());
    }

    @Test
    @DisplayName("duplicate confirmations are rejected")
    void duplicateConfirmationRejected() {
        UUID id = UUID.randomUUID();
        Alert alert = persistedAlert(id, "reporter-1");
        when(alertRepository.findById(id)).thenReturn(Optional.of(alert));
        when(confirmationRepository.existsByAlertIdAndFingerprint(id, "other-user")).thenReturn(true);

        assertThatThrownBy(() -> alertService.confirm(id, "other-user"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("already confirmed");
    }

    @Test
    @DisplayName("findNearby returns the cached page without touching the database")
    void nearbyCacheHitSkipsDatabase() throws Exception {
        Alert alert = persistedAlert(UUID.randomUUID(), "reporter-1");
        String cachedJson = objectMapper.writeValueAsString(List.of(AlertResponse.from(alert)));
        when(redis.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(cachedJson);

        List<AlertResponse> results = alertService.findNearby(51.5074, -0.1278, 3000, null, 720);

        assertThat(results).hasSize(1);
        assertThat(results.getFirst().id()).isEqualTo(alert.getId());
        verify(alertRepository, never()).findNearby(
                any(Double.class), any(Double.class), any(Double.class),
                any(Double.class), any(Double.class), any(Double.class), any(Double.class),
                any(), any());
    }

    @Test
    @DisplayName("findNearby on cache miss queries the database and caches the result")
    void nearbyCacheMissQueriesDatabase() {
        Alert alert = persistedAlert(UUID.randomUUID(), "reporter-1");
        when(redis.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);
        when(alertRepository.findNearby(
                any(Double.class), any(Double.class), any(Double.class),
                any(Double.class), any(Double.class), any(Double.class), any(Double.class),
                any(), any()))
                .thenReturn(List.of(alert));

        List<AlertResponse> results = alertService.findNearby(51.5074, -0.1278, 3000, null, 720);

        assertThat(results).hasSize(1);
        verify(valueOperations).set(anyString(), anyString(), any(java.time.Duration.class));
    }
}
