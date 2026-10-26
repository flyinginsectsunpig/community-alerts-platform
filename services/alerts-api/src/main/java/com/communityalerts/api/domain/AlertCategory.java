package com.communityalerts.api.domain;

public enum AlertCategory {
    THEFT,
    ASSAULT,
    BURGLARY,
    VANDALISM,
    SUSPICIOUS_ACTIVITY,
    VEHICLE_CRIME,
    DRUGS,
    HARASSMENT,
    HAZARD,
    OTHER;

    /** Only these can be "happening right now"; a stolen bike is not an ongoing danger. */
    public boolean canBeOngoing() {
        return this == ASSAULT || this == HAZARD || this == OTHER;
    }
}
