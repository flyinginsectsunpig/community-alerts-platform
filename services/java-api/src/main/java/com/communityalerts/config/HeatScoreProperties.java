package com.communityalerts.config;

import com.communityalerts.model.IncidentType;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Externalised heat score configuration bound to the
 * {@code app.heat} section of application.yml.
 *
 * This allows weights and recency windows to be changed
 * without modifying source code (Open/Closed Principle).
 */
@Component
@ConfigurationProperties(prefix = "app.heat")
@Getter
@Setter
public class HeatScoreProperties {

    /**
     * Base weights per incident type.
     * Configured under {@code app.heat.weights} in application.yml.
     */
    private Map<String, Integer> weights = Map.of(
            "crime", 5,
            "fire", 4,
            "suspicious", 3,
            "accident", 2,
            "power", 1,
            "info", 1);

    /** Incidents within this many days get full weight (×1.0). */
    private int recencyDaysFull = 7;

    /**
     * Incidents older than recencyDaysFull but within this window get half weight
     * (×0.5).
     */
    private int recencyDaysHalf = 30;

    /**
     * Resolves the weight for a given IncidentType from the configured map.
     * Falls back to 1 if the type is not mapped.
     */
    public int weightFor(IncidentType type) {
        String key = type.name().toLowerCase().replace("_", "");
        // Try exact match first (e.g. "crime"), then with underscores removed
        return weights.getOrDefault(type.name().toLowerCase(),
                weights.getOrDefault(key, 1));
    }
}
