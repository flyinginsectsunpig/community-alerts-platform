package com.communityalerts.api.service;

import com.communityalerts.api.domain.AlertCategory;
import com.communityalerts.api.domain.WatchZone;
import com.communityalerts.api.dto.CreateWatchZoneRequest;
import com.communityalerts.api.dto.WatchZoneResponse;
import com.communityalerts.api.repository.NotificationRepository;
import com.communityalerts.api.repository.WatchZoneRepository;
import com.communityalerts.api.support.ZoneOwner;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WatchZoneServiceTest {

    @Mock
    private WatchZoneRepository watchZoneRepository;
    @Mock
    private NotificationRepository notificationRepository;

    private WatchZoneService watchZoneService;

    @BeforeEach
    void setUp() {
        watchZoneService = new WatchZoneService(watchZoneRepository, notificationRepository);
    }

    private static CreateWatchZoneRequest validRequest() {
        return new CreateWatchZoneRequest(
                "Home", "Sam@Example.com ", 51.5074, -0.1278, 1500,
                List.of(AlertCategory.THEFT, AlertCategory.BURGLARY));
    }

    static WatchZone zoneOwnedByUser(UUID userId) {
        WatchZone zone = new WatchZone();
        zone.setId(UUID.randomUUID());
        zone.setName("Home");
        zone.setContactEmail("sam@example.com");
        zone.setCenterLat(51.5074);
        zone.setCenterLng(-0.1278);
        zone.setRadiusM(1500);
        zone.setUserId(userId);
        return zone;
    }

    static WatchZone zoneOwnedByFingerprint(String fingerprint) {
        WatchZone zone = zoneOwnedByUser(null);
        zone.setOwnerFingerprint(fingerprint);
        return zone;
    }

    @Test
    @DisplayName("anonymous create stores the client fingerprint and no user")
    void anonymousCreateStoresFingerprint() {
        when(watchZoneRepository.save(any(WatchZone.class))).thenAnswer(inv -> inv.getArgument(0));

        watchZoneService.create(validRequest(), new ZoneOwner(null, "fp-123"));

        ArgumentCaptor<WatchZone> captor = ArgumentCaptor.forClass(WatchZone.class);
        verify(watchZoneRepository).save(captor.capture());
        assertThat(captor.getValue().getOwnerFingerprint()).isEqualTo("fp-123");
        assertThat(captor.getValue().getUserId()).isNull();
        assertThat(captor.getValue().getContactEmail()).isEqualTo("sam@example.com");
    }

    @Test
    @DisplayName("signed-in create stores the user and no fingerprint")
    void signedInCreateStoresUser() {
        when(watchZoneRepository.save(any(WatchZone.class))).thenAnswer(inv -> inv.getArgument(0));
        UUID userId = UUID.randomUUID();

        watchZoneService.create(validRequest(), new ZoneOwner(userId, null));

        ArgumentCaptor<WatchZone> captor = ArgumentCaptor.forClass(WatchZone.class);
        verify(watchZoneRepository).save(captor.capture());
        assertThat(captor.getValue().getUserId()).isEqualTo(userId);
        assertThat(captor.getValue().getOwnerFingerprint()).isNull();
    }

    @Test
    @DisplayName("listForOwner scopes by user id when authenticated")
    void listScopesByUser() {
        UUID userId = UUID.randomUUID();
        when(watchZoneRepository.findByUserIdOrderByCreatedAtDesc(userId))
                .thenReturn(List.of(zoneOwnedByUser(userId)));

        List<WatchZoneResponse> zones = watchZoneService.listForOwner(new ZoneOwner(userId, null));

        assertThat(zones).hasSize(1);
    }

    @Test
    @DisplayName("listForOwner scopes by fingerprint when anonymous")
    void listScopesByFingerprint() {
        when(watchZoneRepository.findByOwnerFingerprintOrderByCreatedAtDesc("fp-123"))
                .thenReturn(List.of(zoneOwnedByFingerprint("fp-123")));

        List<WatchZoneResponse> zones = watchZoneService.listForOwner(new ZoneOwner(null, "fp-123"));

        assertThat(zones).hasSize(1);
    }
}
