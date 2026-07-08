package com.communityalerts.api.domain;

/**
 * Assigned asynchronously by the ML service; alerts are born UNSCORED.
 */
public enum Severity {
    UNSCORED,
    LOW,
    MEDIUM,
    HIGH,
    CRITICAL
}
