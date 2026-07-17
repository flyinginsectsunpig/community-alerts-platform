package com.communityalerts.api.config;

import com.communityalerts.api.domain.AlertCategory;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Per-category alert lifetimes (app.alerts.ttl-hours.*). Keys are
 * {@link AlertCategory} names; categories without an entry fall back to
 * {@link #DEFAULT_TTL_HOURS}.
 */
@Component
@ConfigurationProperties(prefix = "app.alerts")
public class AlertLifecycleProperties {

    static final int DEFAULT_TTL_HOURS = 72;

    private final Map<String, Integer> ttlHours = new HashMap<>();

    public Map<String, Integer> getTtlHours() {
        return ttlHours;
    }

    public void setTtlHours(Map<String, Integer> hours) {
        ttlHours.clear();
        // Relaxed binding can lowercase map keys; normalize to enum names.
        hours.forEach((key, value) -> ttlHours.put(key.toUpperCase(Locale.ROOT), value));
    }

    public Duration ttlFor(AlertCategory category) {
        return Duration.ofHours(ttlHours.getOrDefault(category.name(), DEFAULT_TTL_HOURS));
    }
}
