package com.communityalerts.api.repository;

import com.communityalerts.api.domain.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

    Optional<PushSubscription> findByEndpoint(String endpoint);

    /** Mirrors the watch-zone claim: device subscriptions follow the account. */
    @Modifying
    @Query("""
            UPDATE PushSubscription p
            SET p.userId = :userId, p.ownerFingerprint = null
            WHERE p.ownerFingerprint = :fingerprint
            """)
    int claimByFingerprint(@Param("userId") UUID userId, @Param("fingerprint") String fingerprint);
}
