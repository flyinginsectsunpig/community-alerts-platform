package com.communityalerts.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.communityalerts.config.HeatScoreProperties;
import com.communityalerts.model.Incident;
import com.communityalerts.repository.IncidentRepository;
import com.communityalerts.repository.SuburbRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * HeatScoreServiceImpl — the engine behind the suburb colour system.
 *
 * Algorithm: For each incident in the last 30 days: 1. Look up the base weight
 * for its type (crime=5, fire=4 … info=1) 2. Multiply by the incident's
 * severity (1–5 reporter-assigned scale) 3. Apply a recency decay factor:
 * incidents within 7 days → ×1.0 (full weight) incidents 7–30 days old → ×0.5
 * (half weight) 4. Sum all weighted scores for the suburb
 *
 * Thresholds → alert level: score < 12 → GREEN
 * 12–19 → YELLOW
 * 20–29 → ORANGE
 * >= 30 → RED
 *
 * This is intentionally explainable — a recruiter should be able to read this
 * and understand every decision. The Python ML service (Stage 3) will extend
 * this with a trained regression model for predictive scoring.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class HeatScoreServiceImpl implements HeatScoreService {

    private final IncidentRepository incidentRepository;
    private final SuburbRepository suburbRepository;
    private final HeatScoreProperties heatProperties;
    private final SuburbAlertPublisher alertPublisher;

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @CacheEvict(value = "suburbs", allEntries = true)
    public int recalculateForSuburb(String suburbId) {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(heatProperties.getRecencyDaysHalf());
        List<Incident> recent = incidentRepository.findRecentBySuburb(suburbId, cutoff);

        int score = computeScore(recent);

        suburbRepository.findById(suburbId).ifPresent(suburb -> {
            suburb.setHeatScore(score);
            suburbRepository.save(suburb);
            log.debug("Heat score updated → suburb={} score={} level={}",
                    suburbId, score, toAlertLevel(score));

            // Publish escalation event to RabbitMQ
            alertPublisher.publishIfEscalated(
                    suburb.getId(), suburb.getName(), score, toAlertLevel(score));
        });

        return score;
    }

    @Override
    @CacheEvict(value = "suburbs", allEntries = true)
    public void recalculateAll() {
        log.info("Running full heat score recalculation for all suburbs");
        // Each suburb recalculates in its own REQUIRES_NEW transaction so a single
        // slow DB round-trip or RabbitMQ publish can never time-out the whole batch.
        suburbRepository.findAll().forEach(suburb -> {
            try {
                recalculateForSuburb(suburb.getId());
            } catch (Exception e) {
                log.warn("Heat score recalc failed for suburb={}: {}", suburb.getId(), e.getMessage());
            }
        });
    }

    @Override
    public int computeScore(List<Incident> incidents) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime fullCutoff = now.minusDays(heatProperties.getRecencyDaysFull());

        double rawScore = incidents.stream()
                .mapToDouble(incident -> {
                    int baseWeight = heatProperties.weightFor(incident.getType());
                    int severity = clampSeverity(incident.getSeverity());
                    double recency = incident.getCreatedAt().isAfter(fullCutoff) ? 1.0 : 0.5;
                    return baseWeight * severity * recency;
                })
                .sum();

        return (int) Math.round(rawScore);
    }

    @Override
    public String toAlertLevel(int score) {
        if (score >= 30) {
            return "RED";
        }
        if (score >= 20) {
            return "ORANGE";
        }
        if (score >= 12) {
            return "YELLOW";
        }
        return "GREEN";
    }

    private static int clampSeverity(Integer value) {
        if (value == null) {
            return 3;
        }
        return Math.max(1, Math.min(value, 5));
    }
}
