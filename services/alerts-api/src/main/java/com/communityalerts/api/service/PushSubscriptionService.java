package com.communityalerts.api.service;

import com.communityalerts.api.domain.PushSubscription;
import com.communityalerts.api.dto.SavePushSubscriptionRequest;
import com.communityalerts.api.repository.PushSubscriptionRepository;
import com.communityalerts.api.support.ZoneOwner;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PushSubscriptionService {

    private final PushSubscriptionRepository repository;

    public PushSubscriptionService(PushSubscriptionRepository repository) {
        this.repository = repository;
    }

    /** Upsert by endpoint: re-subscribing or signing in re-owns the device. */
    @Transactional
    public void save(SavePushSubscriptionRequest request, ZoneOwner owner) {
        PushSubscription subscription = repository.findByEndpoint(request.endpoint())
                .orElseGet(PushSubscription::new);
        subscription.setEndpoint(request.endpoint());
        subscription.setP256dh(request.keys().p256dh());
        subscription.setAuth(request.keys().auth());
        subscription.setUserId(owner.userId());
        subscription.setOwnerFingerprint(owner.fingerprint());
        repository.save(subscription);
    }

    /** Silent no-op when the endpoint is unknown or owned by someone else. */
    @Transactional
    public void delete(String endpoint, ZoneOwner owner) {
        repository.findByEndpoint(endpoint)
                .filter(subscription -> owner.isAuthenticated()
                        ? owner.userId().equals(subscription.getUserId())
                        : subscription.getUserId() == null
                                && owner.fingerprint().equals(subscription.getOwnerFingerprint()))
                .ifPresent(repository::delete);
    }
}
