package com.communityalerts.api.service;

import com.communityalerts.api.domain.AlertCategory;
import com.communityalerts.api.domain.WatchZone;
import com.communityalerts.api.dto.CreateWatchZoneRequest;
import com.communityalerts.api.dto.NotificationResponse;
import com.communityalerts.api.dto.WatchZoneResponse;
import com.communityalerts.api.error.NotFoundException;
import com.communityalerts.api.repository.NotificationRepository;
import com.communityalerts.api.repository.WatchZoneRepository;
import com.communityalerts.api.support.ZoneOwner;
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
    public WatchZoneResponse create(CreateWatchZoneRequest request, ZoneOwner owner) {
        WatchZone zone = new WatchZone();
        zone.setId(UUID.randomUUID());
        zone.setUserId(owner.userId());
        zone.setOwnerFingerprint(owner.fingerprint());
        applyRequest(zone, request);
        return WatchZoneResponse.from(watchZoneRepository.save(zone));
    }

    @Transactional(readOnly = true)
    public List<WatchZoneResponse> listForOwner(ZoneOwner owner) {
        List<WatchZone> zones = owner.isAuthenticated()
                ? watchZoneRepository.findByUserIdOrderByCreatedAtDesc(owner.userId())
                : watchZoneRepository.findByOwnerFingerprintOrderByCreatedAtDesc(owner.fingerprint());
        return zones.stream().map(WatchZoneResponse::from).toList();
    }

    private static void applyRequest(WatchZone zone, CreateWatchZoneRequest request) {
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
    }

    @Transactional
    public WatchZoneResponse update(UUID id, CreateWatchZoneRequest request, ZoneOwner owner) {
        WatchZone zone = findOwned(id, owner);
        applyRequest(zone, request);
        return WatchZoneResponse.from(watchZoneRepository.save(zone));
    }

    @Transactional
    public void delete(UUID id, ZoneOwner owner) {
        watchZoneRepository.delete(findOwned(id, owner));
    }

    private WatchZone findOwned(UUID id, ZoneOwner owner) {
        WatchZone zone = watchZoneRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Watch zone %s not found".formatted(id)));
        boolean owned = owner.isAuthenticated()
                ? owner.userId().equals(zone.getUserId())
                : zone.getUserId() == null
                        && zone.getOwnerFingerprint() != null
                        && zone.getOwnerFingerprint().equals(owner.fingerprint());
        if (!owned) {
            // 404 rather than 403: don't reveal that the zone exists.
            throw new NotFoundException("Watch zone %s not found".formatted(id));
        }
        return zone;
    }

    @Transactional(readOnly = true)
    public List<WatchZoneResponse> claimable(String fingerprint) {
        return watchZoneRepository.findByOwnerFingerprintAndUserIdIsNull(fingerprint)
                .stream().map(WatchZoneResponse::from).toList();
    }

    @Transactional
    public List<WatchZoneResponse> claim(UUID userId, String fingerprint) {
        List<WatchZone> zones = watchZoneRepository.findByOwnerFingerprintAndUserIdIsNull(fingerprint);
        zones.forEach(zone -> {
            zone.setUserId(userId);
            zone.setOwnerFingerprint(null);
        });
        return watchZoneRepository.saveAll(zones).stream().map(WatchZoneResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> notifications(UUID zoneId, ZoneOwner owner) {
        findOwned(zoneId, owner);
        return notificationRepository.findTop100ByWatchZoneIdOrderByCreatedAtDesc(zoneId)
                .stream()
                .map(NotificationResponse::from)
                .toList();
    }
}
