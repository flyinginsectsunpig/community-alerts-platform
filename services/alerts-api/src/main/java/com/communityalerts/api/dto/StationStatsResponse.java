package com.communityalerts.api.dto;

import java.util.List;
import java.util.Map;

public record StationStatsResponse(
        StationResponse station,
        LatestQuarter latestQuarter,   // null when a station has no stat rows
        List<CategoryStats> categories) {

    public record LatestQuarter(String label,
                                long totalSerious,
                                Long totalSeriousPrevYear,   // null when no prior-year data
                                List<TopCategory> topCategories) {}

    public record TopCategory(String category, long count, Long prevYearCount) {}

    public record CategoryStats(String category, List<Period> periods) {}

    /** One 3-month window ("Jan–Mar") with totals keyed by year ("2022" .. "2026"). */
    public record Period(String months, Map<String, Long> totals) {}
}
