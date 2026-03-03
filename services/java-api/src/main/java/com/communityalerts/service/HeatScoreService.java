package com.communityalerts.service;

import com.communityalerts.model.Incident;
import com.communityalerts.model.IncidentType;
import com.communityalerts.model.Suburb;
import com.communityalerts.repository.IncidentRepository;
import com.communityalerts.repository.SuburbRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * HeatScoreService — the engine behind the suburb colour system.
 *
 * Algorithm:
 *   For each incident in the last 30 days:
 *     1. Look up the base weight for its type  (crime=5, fire=4 … info=1)
 *     2. Multiply by the incident's severity   (1–5 reporter-assigned scale)
 *     3. Apply a recency decay factor:
 *          incidents within 7 days  → ×1.0 (full weight)
 *          incidents 7–30 days old  → ×0.5 (half weight)
 *     4. Sum all weighted scores for the suburb
 *
 *   Thresholds → alert level:
 *     score < 12  → GREEN
 *     12–19       → YELLOW
 *     20–29       → ORANGE
 *     >= 30       → RED
 *
 * This is intentionally explainable — a recruiter should be able to read
 * this and understand every decision.  The Python ML service (Stage 3)
 * will extend this with a trained regression model for predictive scoring.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class HeatScoreService {

    private final IncidentRepository incidentRepository;
    private final SuburbRepository   suburbRepository;

    @Value("${app.heat.recency-days-full:7}")
    private int recencyDaysFull = 7;

    @Value("${app.heat.recency-days-half:30}")
    private int recencyDaysHalf = 30;

    // Base weights per incident type
    private static final Map<IncidentType, Integer> TYPE_WEIGHTS = Map.of(
        IncidentType.CRIME,        5,
        IncidentType.FIRE,         4,
        IncidentType.SUSPICIOUS,   3,
        IncidentType.ACCIDENT,     2,
        IncidentType.POWER_OUTAGE, 1,
        IncidentType.INFO,         1
    );

    /**
     * Recalculates the heat score for a single suburb and persists it.
     * Called every time a new incident is reported in that suburb.
     */
    @Transactional
    public int recalculateForSuburb(String suburbId) {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(recencyDaysHalf);
        List<Incident> recent = incidentRepository.findRecentBySuburb(suburbId, cutoff);

        int score = computeScore(recent);

        suburbRepository.findById(suburbId).ifPresent(suburb -> {
            suburb.setHeatScore(score);
            suburbRepository.save(suburb);
            log.debug("Heat score updated → suburb={} score={} level={}",
                suburbId, score, toAlertLevel(score));
        });

        return score;
    }

    /**
     * Full recalculation pass over all suburbs.
     * Could be scheduled nightly or triggered on demand.
     */
    @Transactional
    public void recalculateAll() {
        log.info("Running full heat score recalculation for all suburbs");
        suburbRepository.findAll().forEach(suburb ->
            recalculateForSuburb(suburb.getId())
        );
    }

    /**
     * Core scoring function — pure, testable, no side effects.
     */
    public int computeScore(List<Incident> incidents) {
        LocalDateTime now       = LocalDateTime.now();
        LocalDateTime fullCutoff = now.minusDays(recencyDaysFull);

        double rawScore = incidents.stream()
            .mapToDouble(incident -> {
                int    baseWeight = TYPE_WEIGHTS.getOrDefault(incident.getType(), 1);
                int    severity   = incident.getSeverity() != null ? incident.getSeverity() : 3;
                double recency    = incident.getCreatedAt().isAfter(fullCutoff) ? 1.0 : 0.5;
                return baseWeight * severity * recency;
            })
            .sum();

        return (int) Math.round(rawScore);
    }

    /**
     * Maps a numeric score to a named alert level.
     * Exposed publicly so the SuburbService can include it in responses.
     */
    public String toAlertLevel(int score) {
        if (score >= 30) return "RED";
        if (score >= 20) return "ORANGE";
        if (score >= 12) return "YELLOW";
        return "GREEN";
    }
}
