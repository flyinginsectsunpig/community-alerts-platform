package com.communityalerts.api.web;

import com.communityalerts.api.domain.AlertCategory;
import com.communityalerts.api.dto.AlertResponse;
import com.communityalerts.api.dto.CreateAlertRequest;
import com.communityalerts.api.dto.SeverityPreview;
import com.communityalerts.api.dto.SeverityPreviewRequest;
import com.communityalerts.api.auth.AuthContext;
import com.communityalerts.api.service.AlertService;
import com.communityalerts.api.service.MlServiceClient;
import com.communityalerts.api.support.ClientFingerprint;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/alerts")
@Validated
public class AlertController {

    private final AlertService alertService;
    private final MlServiceClient mlServiceClient;

    public AlertController(AlertService alertService, MlServiceClient mlServiceClient) {
        this.alertService = alertService;
        this.mlServiceClient = mlServiceClient;
    }

    /** Reporting requires an account: pings are visible to everyone. */
    @PostMapping
    public ResponseEntity<AlertResponse> create(@Valid @RequestBody CreateAlertRequest request,
                                                HttpServletRequest httpRequest) {
        AlertResponse created = alertService.create(
                request, ClientFingerprint.of(httpRequest), AuthContext.require(httpRequest));
        return ResponseEntity
                .created(URI.create("/api/v1/alerts/" + created.id()))
                .body(created);
    }

    @GetMapping("/nearby")
    public List<AlertResponse> nearby(
            @RequestParam @DecimalMin("-90") @DecimalMax("90") double lat,
            @RequestParam @DecimalMin("-180") @DecimalMax("180") double lng,
            @RequestParam(defaultValue = "3000") @Min(100) @Max(50000) int radiusM,
            @RequestParam(required = false) AlertCategory category,
            @RequestParam(defaultValue = "720") @Min(1) @Max(8760) int sinceHours) {
        return alertService.findNearby(lat, lng, radiusM, category, sinceHours);
    }

    @GetMapping("/{id}")
    public AlertResponse get(@PathVariable UUID id) {
        return alertService.get(id);
    }

    /** Confirming flips alerts to VERIFIED for everyone, so it needs an account too. */
    @PostMapping("/{id}/confirm")
    public AlertResponse confirm(@PathVariable UUID id, HttpServletRequest httpRequest) {
        return alertService.confirm(
                id, ClientFingerprint.of(httpRequest), AuthContext.require(httpRequest));
    }

    @PostMapping("/severity-preview")
    public SeverityPreview severityPreview(@Valid @RequestBody SeverityPreviewRequest request) {
        return mlServiceClient.previewSeverity(request.text());
    }
}
