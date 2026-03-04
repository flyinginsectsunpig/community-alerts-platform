package com.communityalerts;

import com.communityalerts.config.HeatScoreProperties;
import com.communityalerts.model.Incident;
import com.communityalerts.model.IncidentType;
import com.communityalerts.model.Suburb;
import com.communityalerts.service.HeatScoreServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for the heat scoring algorithm.
 * These tests document the business rules in an executable form.
 */
class HeatScoreServiceTest {

    private HeatScoreServiceImpl service;

    @BeforeEach
    void setUp() {
        HeatScoreProperties props = new HeatScoreProperties();
        // Uses default weights (crime=5, fire=4, etc.) and
        // default recency windows (7d full, 30d half)
        service = new HeatScoreServiceImpl(null, null, props, null);
    }

    @Test
    @DisplayName("Empty suburb → score is 0 → GREEN")
    void emptySuburb() {
        int score = service.computeScore(List.of());
        assertThat(score).isEqualTo(0);
        assertThat(service.toAlertLevel(score)).isEqualTo("GREEN");
    }

    @Test
    @DisplayName("Single recent crime severity 5 → score 25 → ORANGE")
    void singleHighSeverityCrime() {
        Incident crime = buildIncident(IncidentType.CRIME, 5, LocalDateTime.now().minusHours(2));
        // weight=5, severity=5, recency=1.0 → 25
        int score = service.computeScore(List.of(crime));
        assertThat(score).isEqualTo(25);
        assertThat(service.toAlertLevel(score)).isEqualTo("ORANGE");
    }

    @Test
    @DisplayName("Multiple crimes push suburb to RED")
    void multipleIncidentsTriggerRed() {
        List<Incident> incidents = List.of(
                buildIncident(IncidentType.CRIME, 5, LocalDateTime.now().minusHours(1)),
                buildIncident(IncidentType.CRIME, 4, LocalDateTime.now().minusHours(3)),
                buildIncident(IncidentType.FIRE, 3, LocalDateTime.now().minusDays(2)));
        int score = service.computeScore(incidents);
        // 25 + 20 + 12 = 57
        assertThat(score).isGreaterThanOrEqualTo(30);
        assertThat(service.toAlertLevel(score)).isEqualTo("RED");
    }

    @Test
    @DisplayName("Old incidents (7–30 days) are half-weighted")
    void recencyDecayApplied() {
        Incident recent = buildIncident(IncidentType.CRIME, 2, LocalDateTime.now().minusDays(1));
        Incident old = buildIncident(IncidentType.CRIME, 2, LocalDateTime.now().minusDays(20));
        // recent: 5*2*1.0=10, old: 5*2*0.5=5
        int score = service.computeScore(List.of(recent, old));
        assertThat(score).isEqualTo(15);
    }

    @Test
    @DisplayName("Info-only suburb stays GREEN")
    void infoOnlyIsGreen() {
        List<Incident> infos = List.of(
                buildIncident(IncidentType.INFO, 1, LocalDateTime.now().minusHours(1)),
                buildIncident(IncidentType.INFO, 2, LocalDateTime.now().minusHours(2)));
        int score = service.computeScore(infos);
        assertThat(service.toAlertLevel(score)).isEqualTo("GREEN");
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Incident buildIncident(IncidentType type, int severity, LocalDateTime createdAt) {
        Suburb suburb = Suburb.builder().id("test").name("Test Suburb")
                .latitude(-33.9).longitude(18.4).build();
        Incident i = new Incident();
        i.setSuburb(suburb);
        i.setType(type);
        i.setSeverity(severity);
        i.setCreatedAt(createdAt);
        i.setTitle("Test");
        i.setDescription("Test description");
        i.setLatitude(-33.9);
        i.setLongitude(18.4);
        return i;
    }
}
