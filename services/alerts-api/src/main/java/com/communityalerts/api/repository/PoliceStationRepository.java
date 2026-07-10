package com.communityalerts.api.repository;

import com.communityalerts.api.domain.PoliceStation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PoliceStationRepository extends JpaRepository<PoliceStation, Long> {

    @Query(value = """
            SELECT * FROM police_stations
            WHERE lat BETWEEN :minLat AND :maxLat
              AND lng BETWEEN :minLng AND :maxLng
            ORDER BY name
            LIMIT 500
            """, nativeQuery = true)
    List<PoliceStation> findInBounds(@Param("minLat") double minLat,
                                     @Param("maxLat") double maxLat,
                                     @Param("minLng") double minLng,
                                     @Param("maxLng") double maxLng);

    interface QuarterTotalRow {
        String getCategory();
        int getYr();
        int getQtr();
        long getTotal();
    }

    /**
     * Quarterly totals per category for one station. station_crime_stats has
     * no JPA entity — it is importer-owned and only ever read via this query.
     */
    @Query(value = """
            SELECT s.category AS category,
                   CAST(EXTRACT(YEAR FROM s.period_month) AS int)    AS yr,
                   CAST(EXTRACT(QUARTER FROM s.period_month) AS int) AS qtr,
                   SUM(s.count) AS total
            FROM station_crime_stats s
            WHERE s.station_id = :stationId
            GROUP BY 1, 2, 3
            ORDER BY 1, 2, 3
            """, nativeQuery = true)
    List<QuarterTotalRow> quarterTotals(@Param("stationId") long stationId);
}
