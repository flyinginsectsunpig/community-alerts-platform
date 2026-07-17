package com.communityalerts.api.service;

import com.communityalerts.api.domain.PushSubscription;
import com.communityalerts.api.dto.SavePushSubscriptionRequest;
import com.communityalerts.api.repository.PushSubscriptionRepository;
import com.communityalerts.api.support.ZoneOwner;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PushSubscriptionServiceTest {

    private static final String ENDPOINT = "https://push.example/send/abc123";

    @Mock
    private PushSubscriptionRepository repository;

    private PushSubscriptionService service;

    @BeforeEach
    void setUp() {
        service = new PushSubscriptionService(repository);
    }

    private static SavePushSubscriptionRequest request() {
        return new SavePushSubscriptionRequest(
                ENDPOINT, new SavePushSubscriptionRequest.Keys("p256dh-key", "auth-secret"));
    }

    @Test
    @DisplayName("saving a new subscription stores the anonymous owner fingerprint")
    void saveStoresFingerprintOwner() {
        when(repository.findByEndpoint(ENDPOINT)).thenReturn(Optional.empty());
        when(repository.save(any(PushSubscription.class))).thenAnswer(inv -> inv.getArgument(0));

        service.save(request(), new ZoneOwner(null, "fp-123"));

        ArgumentCaptor<PushSubscription> captor = ArgumentCaptor.forClass(PushSubscription.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getOwnerFingerprint()).isEqualTo("fp-123");
        assertThat(captor.getValue().getUserId()).isNull();
        assertThat(captor.getValue().getP256dh()).isEqualTo("p256dh-key");
    }

    @Test
    @DisplayName("saving an existing endpoint re-owns it instead of duplicating")
    void saveUpsertsByEndpoint() {
        PushSubscription existing = new PushSubscription();
        existing.setEndpoint(ENDPOINT);
        existing.setOwnerFingerprint("fp-old");
        when(repository.findByEndpoint(ENDPOINT)).thenReturn(Optional.of(existing));
        when(repository.save(any(PushSubscription.class))).thenAnswer(inv -> inv.getArgument(0));

        UUID userId = UUID.randomUUID();
        service.save(request(), new ZoneOwner(userId, null));

        ArgumentCaptor<PushSubscription> captor = ArgumentCaptor.forClass(PushSubscription.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue()).isSameAs(existing);
        assertThat(captor.getValue().getUserId()).isEqualTo(userId);
        assertThat(captor.getValue().getOwnerFingerprint()).isNull();
    }

    @Test
    @DisplayName("delete removes the subscription only for its owner")
    void deleteChecksOwnership() {
        PushSubscription existing = new PushSubscription();
        existing.setEndpoint(ENDPOINT);
        existing.setOwnerFingerprint("fp-123");
        when(repository.findByEndpoint(ENDPOINT)).thenReturn(Optional.of(existing));

        service.delete(ENDPOINT, new ZoneOwner(null, "fp-somebody-else"));
        verify(repository, never()).delete(any());

        service.delete(ENDPOINT, new ZoneOwner(null, "fp-123"));
        verify(repository).delete(existing);
    }
}
