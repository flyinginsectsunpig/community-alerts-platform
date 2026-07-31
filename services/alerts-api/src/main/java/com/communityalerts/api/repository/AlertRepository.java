package com.communityalerts.api.repository;

import com.communityalerts.api.domain.Alert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface AlertRepository extends JpaRepository<Alert, UUID> {

    /**
     * Radius search: cheap bounding-box prefilter (index-friendly) followed by
     * an exact haversine distance check. Runs on vanilla PostgreSQL — no PostGIS.
     */
    @Query(value = """
            SELECT * FROM alerts a
            WHERE a.lat BETWEEN :minLat AND :maxLat
              AND a.lng BETWEEN :minLng AND :maxLng
              AND a.status IN ('ACTIVE', 'VERIFIED')
              AND a.expires_at > now()
              AND a.created_at >= :since
              AND (:category IS NULL OR a.category = :category)
              AND 6371000 * acos(LEAST(1.0,
                    cos(radians(:lat)) * cos(radians(a.lat)) * cos(radians(a.lng) - radians(:lng))
                    + sin(radians(:lat)) * sin(radians(a.lat)))) <= :radiusM
            ORDER BY a.created_at DESC
            LIMIT 500
            """, nativeQuery = true)
    List<Alert> findNearby(@Param("lat") double lat,
                           @Param("lng") double lng,
                           @Param("radiusM") double radiusM,
                           @Param("minLat") double minLat,
                           @Param("maxLat") double maxLat,
                           @Param("minLng") double minLng,
                           @Param("maxLng") double maxLng,
                           @Param("since") Instant since,
                           @Param("category") String category);

    interface CategoryCountRow {
        String getCategory();
        long getCnt();
    }

    interface DayCountRow {
        String getDay();
        long getCnt();
    }

    interface SeverityCountRow {
        String getSeverity();
        long getCnt();
    }

    @Query(value = """
            SELECT category AS category, COUNT(*) AS cnt
            FROM alerts WHERE created_at >= :since
            GROUP BY category ORDER BY cnt DESC
            """, nativeQuery = true)
    List<CategoryCountRow> countByCategorySince(@Param("since") Instant since);

    /**
     * Buckets by local calendar day, not UTC: "how many alerts today" has to
     * mean the day the reader is living in, and the audience is in SAST.
     * created_at is TIMESTAMPTZ, so AT TIME ZONE converts it to wall-clock
     * time in that zone before truncating.
     *
     * The zone is duplicated in the .NET worker's identical query
     * (PostgresRepositories.cs) and in APP_TIMEZONE in the web app's
     * lib/format.ts. All three must agree or the bars and their labels
     * describe different days.
     */
    @Query(value = """
            SELECT to_char(
                       date_trunc('day', created_at AT TIME ZONE 'Africa/Johannesburg'),
                       'YYYY-MM-DD') AS day,
                   COUNT(*) AS cnt
            FROM alerts WHERE created_at >= :since
            GROUP BY 1 ORDER BY 1
            """, nativeQuery = true)
    List<DayCountRow> countByDaySince(@Param("since") Instant since);

    @Query(value = """
            SELECT severity AS severity, COUNT(*) AS cnt
            FROM alerts WHERE created_at >= :since
            GROUP BY severity ORDER BY cnt DESC
            """, nativeQuery = true)
    List<SeverityCountRow> countBySeveritySince(@Param("since") Instant since);
}
