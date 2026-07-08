package com.communityalerts.api.repository;

import com.communityalerts.api.domain.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findTop100ByWatchZoneIdOrderByCreatedAtDesc(UUID watchZoneId);
}
