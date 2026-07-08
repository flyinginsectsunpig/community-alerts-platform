package com.communityalerts.api.web;

import com.communityalerts.api.dto.StatsResponse;
import com.communityalerts.api.service.MlServiceClient;
import com.communityalerts.api.service.StatsService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@Validated
public class StatsController {

    private final StatsService statsService;
    private final MlServiceClient mlServiceClient;

    public StatsController(StatsService statsService, MlServiceClient mlServiceClient) {
        this.statsService = statsService;
        this.mlServiceClient = mlServiceClient;
    }

    @GetMapping("/stats/summary")
    public StatsResponse summary() {
        return statsService.summary();
    }

    @GetMapping("/hotspots")
    public ResponseEntity<String> hotspots(
            @RequestParam(defaultValue = "168") @Min(1) @Max(2160) int windowHours) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(mlServiceClient.fetchHotspots(windowHours));
    }
}
