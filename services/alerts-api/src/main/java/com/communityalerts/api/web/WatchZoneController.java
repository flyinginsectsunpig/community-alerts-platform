package com.communityalerts.api.web;

import com.communityalerts.api.auth.AuthContext;
import com.communityalerts.api.auth.AuthUser;
import com.communityalerts.api.dto.CreateWatchZoneRequest;
import jakarta.servlet.http.HttpServletRequest;
import com.communityalerts.api.dto.NotificationResponse;
import com.communityalerts.api.dto.WatchZoneResponse;
import com.communityalerts.api.service.WatchZoneService;
import com.communityalerts.api.support.ZoneOwner;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/watch-zones")
public class WatchZoneController {

    private final WatchZoneService watchZoneService;

    public WatchZoneController(WatchZoneService watchZoneService) {
        this.watchZoneService = watchZoneService;
    }

    @PostMapping
    public ResponseEntity<WatchZoneResponse> create(@Valid @RequestBody CreateWatchZoneRequest request,
                                                    HttpServletRequest httpRequest) {
        WatchZoneResponse created = watchZoneService.create(request, ZoneOwner.resolve(httpRequest));
        return ResponseEntity
                .created(URI.create("/api/v1/watch-zones/" + created.id()))
                .body(created);
    }

    @GetMapping
    public List<WatchZoneResponse> mine(HttpServletRequest httpRequest) {
        return watchZoneService.listForOwner(ZoneOwner.resolve(httpRequest));
    }

    @PutMapping("/{id}")
    public WatchZoneResponse update(@PathVariable UUID id,
                                    @Valid @RequestBody CreateWatchZoneRequest request,
                                    HttpServletRequest httpRequest) {
        return watchZoneService.update(id, request, ZoneOwner.resolve(httpRequest));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, HttpServletRequest httpRequest) {
        watchZoneService.delete(id, ZoneOwner.resolve(httpRequest));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/claimable")
    public List<WatchZoneResponse> claimable(HttpServletRequest httpRequest) {
        AuthContext.require(httpRequest);
        return watchZoneService.claimable(ZoneOwner.requireClientFingerprint(httpRequest));
    }

    @PostMapping("/claim")
    public List<WatchZoneResponse> claim(HttpServletRequest httpRequest) {
        AuthUser user = AuthContext.require(httpRequest);
        return watchZoneService.claim(user.id(), ZoneOwner.requireClientFingerprint(httpRequest));
    }

    @GetMapping("/{id}/notifications")
    public List<NotificationResponse> notifications(@PathVariable UUID id,
                                                    HttpServletRequest httpRequest) {
        return watchZoneService.notifications(id, ZoneOwner.resolve(httpRequest));
    }
}
