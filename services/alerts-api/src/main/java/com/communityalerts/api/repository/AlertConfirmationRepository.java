package com.communityalerts.api.repository;

import com.communityalerts.api.domain.AlertConfirmation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AlertConfirmationRepository extends JpaRepository<AlertConfirmation, Long> {

    boolean existsByAlertIdAndUserId(UUID alertId, UUID userId);
}
