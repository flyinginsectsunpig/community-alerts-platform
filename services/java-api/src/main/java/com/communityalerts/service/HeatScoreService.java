package com.communityalerts.service;

import com.communityalerts.model.Incident;

import java.util.List;

/**
 * Contract for the heat score calculation engine.
 *
 * The heat score drives the suburb colour system on the map:
 * GREEN < 12 | YELLOW 12–19 | ORANGE 20–29 | RED >= 30
 */
public interface HeatScoreService {

    /**
     * Recalculates the heat score for a single suburb and persists it.
     * Called every time a new incident is reported in that suburb.
     */
    int recalculateForSuburb(String suburbId);

    /**
     * Full recalculation pass over all suburbs.
     * Could be scheduled nightly or triggered on demand.
     */
    void recalculateAll();

    /**
     * Core scoring function — pure, testable, no side effects.
     */
    int computeScore(List<Incident> incidents);

    /**
     * Maps a numeric score to a named alert level.
     * Exposed publicly so the SuburbService can include it in responses.
     */
    String toAlertLevel(int score);
}
