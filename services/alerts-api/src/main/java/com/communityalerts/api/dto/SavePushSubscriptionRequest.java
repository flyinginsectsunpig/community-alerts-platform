package com.communityalerts.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** The browser's {@code PushSubscription.toJSON()} shape (expirationTime ignored). */
public record SavePushSubscriptionRequest(
        @NotBlank @Size(max = 2048) String endpoint,
        @NotNull @Valid Keys keys) {

    public record Keys(
            @NotBlank @Size(max = 512) String p256dh,
            @NotBlank @Size(max = 512) String auth) {
    }
}
