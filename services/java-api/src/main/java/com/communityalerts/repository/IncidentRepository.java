package com.communityalerts.repository;

import com.communityalerts.model.Incident;
import com.communityalerts.model.IncidentType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface IncidentRepository extends JpaRepository<Incident, Long> {

    /** All incidents for a suburb, newest first — used by the map feed. */
    Page<Incident> findBySuburbIdOrderByCreatedAtDesc(String suburbId, Pageable pageable);

    /** Filter by type across all suburbs. */
    Page<Incident> findByTypeOrderByCreatedAtDesc(IncidentType type, Pageable pageable);

    /** Count incidents per suburb in a time window — used by HeatScoreService. */
    @Query("""
                SELECT i FROM Incident i
                WHERE i.suburb.id = :suburbId
                AND   i.createdAt >= :since
                ORDER BY i.createdAt DESC
            """)
    List<Incident> findRecentBySuburb(@Param("suburbId") String suburbId,
            @Param("since") LocalDateTime since);

    /**
     * Radius search — finds incidents within approximately N km of a coordinate.
     */
    @Query("""
                SELECT i FROM Incident i
                WHERE (6371 * acos(
                    cos(radians(:lat)) * cos(radians(i.latitude)) *
                    cos(radians(i.longitude) - radians(:lng)) +
                    sin(radians(:lat)) * sin(radians(i.latitude))
                )) <= :radiusKm
                ORDER BY i.createdAt DESC
            """)
    List<Incident> findWithinRadius(@Param("lat") double lat,
            @Param("lng") double lng,
            @Param("radiusKm") double radiusKm);
}
