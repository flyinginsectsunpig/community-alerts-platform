package com.communityalerts.controller;

import com.communityalerts.dto.IncidentRequest;
import com.communityalerts.dto.IncidentResponse;
import com.communityalerts.model.IncidentType;
import com.communityalerts.service.IncidentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import com.communityalerts.config.RateLimitFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/incidents")
@RequiredArgsConstructor
@Tag(name = "Incidents", description = "Create, read, and filter community alerts on the map")
public class IncidentController {

    private final IncidentService incidentService;
    private final RateLimitFilter rateLimitFilter;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Report a new incident", description = "Creates a map ping and triggers a suburb heat score recalculation.")
    public IncidentResponse create(
            @Valid @RequestBody IncidentRequest request,
            HttpServletRequest httpRequest) {
        rateLimitFilter.checkIncidentLimit(httpRequest.getRemoteAddr());
        return incidentService.create(request);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get incident by ID")
    public IncidentResponse findById(@PathVariable Long id) {
        return incidentService.findById(id);
    }

    @GetMapping
    @Operation(summary = "List all incidents (paginated, newest first)")
    public Page<IncidentResponse> findAll(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return incidentService.findAll(pageable);
    }

    @GetMapping("/suburb/{suburbId}")
    @Operation(summary = "Get all incidents for a specific suburb")
    public Page<IncidentResponse> findBySuburb(
            @PathVariable String suburbId,
            @PageableDefault(size = 20) Pageable pageable) {
        return incidentService.findBySuburb(suburbId, pageable);
    }

    @GetMapping("/type/{type}")
    @Operation(summary = "Filter incidents by type across all suburbs")
    public Page<IncidentResponse> findByType(
            @PathVariable IncidentType type,
            @PageableDefault(size = 20) Pageable pageable) {
        return incidentService.findByType(type, pageable);
    }

    @GetMapping("/nearby")
    @Operation(summary = "Find incidents within a radius of a coordinate", description = "Uses the Haversine formula. Default radius is 2km.")
    public List<IncidentResponse> findNearby(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(defaultValue = "2.0") double radiusKm) {
        return incidentService.findNearby(lat, lng, radiusKm);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove an incident (moderator action)")
    public void delete(@PathVariable Long id) {
        incidentService.delete(id);
    }
}
