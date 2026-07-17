package com.communityalerts.api.web;

import com.communityalerts.api.dto.SavePushSubscriptionRequest;
import com.communityalerts.api.service.PushSubscriptionService;
import com.communityalerts.api.support.ZoneOwner;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Web Push subscriptions. Anonymous-friendly (same ownership model as watch
 * zones). The endpoint travels in the JSON body — it is a capability URL and
 * must stay out of access logs, so no query parameters.
 */
@RestController
@RequestMapping("/api/v1/push/subscriptions")
public class PushSubscriptionController {

    private final PushSubscriptionService pushSubscriptionService;

    public PushSubscriptionController(PushSubscriptionService pushSubscriptionService) {
        this.pushSubscriptionService = pushSubscriptionService;
    }

    @PostMapping
    public ResponseEntity<Void> save(@Valid @RequestBody SavePushSubscriptionRequest request,
                                     HttpServletRequest httpRequest) {
        pushSubscriptionService.save(request, ZoneOwner.resolve(httpRequest));
        return ResponseEntity.noContent().build();
    }

    public record DeletePushSubscriptionRequest(@NotBlank String endpoint) {
    }

    @DeleteMapping
    public ResponseEntity<Void> delete(@Valid @RequestBody DeletePushSubscriptionRequest request,
                                       HttpServletRequest httpRequest) {
        pushSubscriptionService.delete(request.endpoint(), ZoneOwner.resolve(httpRequest));
        return ResponseEntity.noContent().build();
    }
}
