package com.communityalerts.service;

import com.communityalerts.model.IncidentType;

/**
 * Maps raw offence descriptions (e.g. from SAPS data) to the
 * platform's IncidentType and severity scale.
 *
 * Extracted from ExcelImportService so the same classification
 * logic can be reused by any future import channel (CSV, API, etc.)
 * without duplicating the mapping rules.
 */
public final class IncidentTypeClassifier {

    private IncidentTypeClassifier() {
        // utility class — no instances
    }

    /**
     * Determines the IncidentType from a free-text offence string.
     */
    public static IncidentType classifyType(String offence) {
        String lower = offence.toLowerCase();
        if (lower.contains("murder") || lower.contains("assault") ||
                lower.contains("robbery") || lower.contains("theft") ||
                lower.contains("crime") || lower.contains("burglary") ||
                lower.contains("hijacking")) {
            return IncidentType.CRIME;
        } else if (lower.contains("accident") || lower.contains("crash")) {
            return IncidentType.ACCIDENT;
        } else if (lower.contains("fire") || lower.contains("arson")) {
            return IncidentType.FIRE;
        } else if (lower.contains("suspicious")) {
            return IncidentType.SUSPICIOUS;
        } else if (lower.contains("power") || lower.contains("electricity")) {
            return IncidentType.POWER_OUTAGE;
        }
        return IncidentType.INFO;
    }

    /**
     * Returns a default severity (1–5) for a given IncidentType.
     */
    public static int defaultSeverity(IncidentType type) {
        return switch (type) {
            case CRIME, FIRE -> 5;
            case ACCIDENT -> 4;
            case SUSPICIOUS -> 3;
            case POWER_OUTAGE -> 2;
            case INFO -> 1;
        };
    }
}
