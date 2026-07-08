package com.communityalerts.api.repository;

import com.communityalerts.api.domain.WatchZone;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface WatchZoneRepository extends JpaRepository<WatchZone, UUID> {
}
