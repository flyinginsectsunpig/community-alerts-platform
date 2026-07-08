package com.communityalerts.api.service;

import com.communityalerts.api.domain.AlertCategory;
import com.communityalerts.api.domain.WatchZone;
import com.communityalerts.api.dto.CreateWatchZoneRequest;
import com.communityalerts.api.dto.NotificationResponse;
import com.communityalerts.api.dto.WatchZoneResponse;
import com.communityalerts.api.error.NotFoundException;
import com.communityalerts.api.repository.NotificationRepository;
import com.communityalerts.api.repository.WatchZoneRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class WatchZoneService {

    private final WatchZoneRepository watchZoneRepository;
    private final NotificationRepository notificationRepository;

    public WatchZoneService(WatchZoneRepository watchZoneRepository,
                            NotificationRepository notificationRepository) {
        this.watchZoneRepository = watchZoneRepository;
        this.notificationRepository = notificationRepository;
    }

    @Transactional
    public WatchZoneResponse create(CreateWatchZoneRequest request) {
        WatchZone zone = new WatchZone();
        zone.setId(UUID.randomUUID());
        zone.setName(request.name().trim());
        zone.setContactEmail(request.contactEmail().trim().toLowerCase());
        zone.setCenterLat(request.centerLat());
        zone.setCenterLng(request.centerLng());
        zone.setRadiusM(request.radiusM());
        zone.setCategoriesCsv(request.categories() == null
                ? ""
                : request.categories().stream()
                        .distinct()
                        .map(AlertCategory::name)
                        .collect(Collectors.joining(",")));
        return WatchZoneResponse.from(watchZoneRepository.save(zone));
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> notifications(UUID zoneId) {
        if (!watchZoneRepository.existsById(zoneId)) {
            throw new NotFoundException("Watch zone %s not found".formatted(zoneId));
        }
        return notificationRepository.findTop100ByWatchZoneIdOrderByCreatedAtDesc(zoneId)
                .stream()
                .map(NotificationResponse::from)
                .toList();
    }
}
