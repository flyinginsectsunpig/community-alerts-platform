package com.communityalerts.api.service;

import com.communityalerts.api.auth.AuthUser;
import com.communityalerts.api.config.RedisPubSubConfig;
import com.communityalerts.api.domain.Alert;
import com.communityalerts.api.domain.AlertCategory;
import com.communityalerts.api.domain.AlertConfirmation;
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
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class AlertService {

    private static final Logger log = LoggerFactory.getLogger(AlertService.class);
    private static final double METERS_PER_DEGREE_LAT = 111_320.0;

    private final AlertRepository alertRepository;
    private final AlertConfirmationRepository confirmationRepository;
    private final AlertEventPublisher eventPublisher;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private final int verifyThreshold;
    private final long nearbyTtlSeconds;

    public AlertService(AlertRepository alertRepository,
                        AlertConfirmationRepository confirmationRepository,
                        AlertEventPublisher eventPublisher,
                        StringRedisTemplate redis,
                        ObjectMapper objectMapper,
                        @Value("${app.alerts.verify-threshold}") int verifyThreshold,
                        @Value("${app.cache.nearby-ttl-seconds}") long nearbyTtlSeconds) {
        this.alertRepository = alertRepository;
        this.confirmationRepository = confirmationRepository;
        this.eventPublisher = eventPublisher;
        this.redis = redis;
        this.objectMapper = objectMapper;
        this.verifyThreshold = verifyThreshold;
        this.nearbyTtlSeconds = nearbyTtlSeconds;
    }

    @Transactional
    public AlertResponse create(CreateAlertRequest request, String reporterFingerprint, AuthUser reporter) {
        Alert alert = new Alert();
        alert.setId(UUID.randomUUID());
        alert.setCategory(request.category());
        alert.setDescription(request.description().trim());
        alert.setLat(request.lat());
        alert.setLng(request.lng());
        alert.setReporterFingerprint(reporterFingerprint);
        alert.setReportedByUserId(reporter.id());

        Alert saved = alertRepository.save(alert);

        eventPublisher.publishAlertCreated(new AlertCreatedEvent(
                saved.getId(),
                saved.getCategory().name(),
                saved.getDescription(),
                saved.getLat(),
                saved.getLng(),
                saved.getCreatedAt()));

        AlertResponse response = AlertResponse.from(saved);
        publishLive("alert.created", response);
        return response;
    }

    @Transactional
    public AlertResponse applySeverity(UUID alertId, Severity severity, double riskScore, String modelVersion) {
        Alert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new NotFoundException("Alert %s not found".formatted(alertId)));
        alert.setSeverity(severity);
        alert.setRiskScore(riskScore);
        Alert saved = alertRepository.save(alert);
        log.debug("Alert {} scored {} by {}", alertId, severity, modelVersion);

        AlertResponse response = AlertResponse.from(saved);
        publishLive("alert.updated", response);
        return response;
    }

    @Transactional
    public AlertResponse confirm(UUID alertId, String fingerprint, AuthUser confirmer) {
        Alert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new NotFoundException("Alert %s not found".formatted(alertId)));

        // Account identity is authoritative; the fingerprint check still
        // covers legacy alerts reported before accounts were required.
        if (confirmer.id().equals(alert.getReportedByUserId())
                || alert.getReporterFingerprint().equals(fingerprint)) {
            throw new ConflictException("You cannot confirm your own report");
        }
        if (confirmationRepository.existsByAlertIdAndUserId(alertId, confirmer.id())) {
            throw new ConflictException("You have already confirmed this alert");
        }
        try {
            confirmationRepository.save(new AlertConfirmation(alertId, fingerprint, confirmer.id()));
        } catch (DataIntegrityViolationException e) {
            // Unique constraint race between the exists-check and the insert.
            throw new ConflictException("You have already confirmed this alert");
        }

        alert.setConfirmationCount(alert.getConfirmationCount() + 1);
        if (alert.getStatus() == AlertStatus.ACTIVE && alert.getConfirmationCount() >= verifyThreshold) {
            alert.setStatus(AlertStatus.VERIFIED);
        }
        Alert saved = alertRepository.save(alert);

        AlertResponse response = AlertResponse.from(saved);
        publishLive("alert.updated", response);
        return response;
    }

    @Transactional(readOnly = true)
    public AlertResponse get(UUID alertId) {
        return alertRepository.findById(alertId)
                .map(AlertResponse::from)
                .orElseThrow(() -> new NotFoundException("Alert %s not found".formatted(alertId)));
    }

    @Transactional(readOnly = true)
    public List<AlertResponse> findNearby(double lat, double lng, int radiusM,
                                          AlertCategory category, int sinceHours) {
        String cacheKey = nearbyCacheKey(lat, lng, radiusM, category, sinceHours);

        List<AlertResponse> cached = readCachedNearby(cacheKey);
        if (cached != null) {
            return cached;
        }

        double latDelta = radiusM / METERS_PER_DEGREE_LAT;
        double lngDelta = radiusM / (METERS_PER_DEGREE_LAT
                * Math.max(0.01, Math.cos(Math.toRadians(lat))));
        Instant since = Instant.now().minus(sinceHours, ChronoUnit.HOURS);

        List<AlertResponse> results = alertRepository.findNearby(
                        lat, lng, radiusM,
                        lat - latDelta, lat + latDelta,
                        lng - lngDelta, lng + lngDelta,
                        since,
                        category == null ? null : category.name())
                .stream()
                .map(AlertResponse::from)
                .toList();

        writeCachedNearby(cacheKey, results);
        return results;
    }

    private String nearbyCacheKey(double lat, double lng, int radiusM,
                                  AlertCategory category, int sinceHours) {
        // ~110 m grid so nearby viewers share cache entries.
        return String.format(Locale.ROOT, "alerts:nearby:%.3f:%.3f:%d:%s:%d",
                lat, lng, radiusM, category == null ? "ALL" : category.name(), sinceHours);
    }

    private List<AlertResponse> readCachedNearby(String cacheKey) {
        try {
            String cached = redis.opsForValue().get(cacheKey);
            if (cached != null) {
                return objectMapper.readValue(cached, new TypeReference<List<AlertResponse>>() {
                });
            }
        } catch (DataAccessException e) {
            log.warn("Redis unavailable for nearby cache read; querying database", e);
        } catch (Exception e) {
            log.warn("Discarding unreadable nearby cache entry {}", cacheKey, e);
        }
        return null;
    }

    private void writeCachedNearby(String cacheKey, List<AlertResponse> results) {
        try {
            redis.opsForValue().set(cacheKey, objectMapper.writeValueAsString(results),
                    Duration.ofSeconds(nearbyTtlSeconds));
        } catch (Exception e) {
            log.warn("Failed to write nearby cache entry {}", cacheKey, e);
        }
    }

    /**
     * Live map updates ride Redis pub/sub so every API replica's SSE clients
     * see them. A live-feed failure must never fail the write path.
     */
    private void publishLive(String type, AlertResponse alert) {
        try {
            redis.convertAndSend(RedisPubSubConfig.LIVE_CHANNEL,
                    objectMapper.writeValueAsString(new LiveEvent(type, alert)));
        } catch (Exception e) {
            log.warn("Failed to publish live event {} for alert {}", type, alert.id(), e);
        }
    }

    public record LiveEvent(String type, AlertResponse alert) {
    }
}
