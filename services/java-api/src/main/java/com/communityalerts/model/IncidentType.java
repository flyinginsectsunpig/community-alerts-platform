package com.communityalerts.model;

/**
 * Categorises an incident on the map.
 * Each type carries a base heat weight used by the HeatScoreService.
 */
public enum IncidentType {
    CRIME,
    ACCIDENT,
    POWER_OUTAGE,
    SUSPICIOUS,
    FIRE,
    INFO;

    public String toDisplayLabel() {
        return switch (this) {
            case CRIME       -> "Crime";
            case ACCIDENT    -> "Accident";
            case POWER_OUTAGE -> "Power Outage";
            case SUSPICIOUS  -> "Suspicious";
            case FIRE        -> "Fire";
            case INFO        -> "Info";
        };
    }
}
