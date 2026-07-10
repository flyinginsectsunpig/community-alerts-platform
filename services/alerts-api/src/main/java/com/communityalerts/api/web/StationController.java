package com.communityalerts.api.web;

import com.communityalerts.api.dto.StationResponse;
import com.communityalerts.api.dto.StationStatsResponse;
import com.communityalerts.api.service.StationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Anonymous read-only endpoints for official SAPS station reference data. */
@RestController
@RequestMapping("/api/v1")
public class StationController {

    private final StationService stationService;

    public StationController(StationService stationService) {
        this.stationService = stationService;
    }

    @GetMapping("/stations")
    public List<StationResponse> inBounds(@RequestParam double minLat,
                                          @RequestParam double maxLat,
                                          @RequestParam double minLng,
                                          @RequestParam double maxLng) {
        return stationService.findInBounds(minLat, maxLat, minLng, maxLng);
    }

    @GetMapping("/stations/{id}/stats")
    public StationStatsResponse stats(@PathVariable long id) {
        return stationService.stats(id);
    }
}
