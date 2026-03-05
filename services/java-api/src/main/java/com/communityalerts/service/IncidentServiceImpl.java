package com.communityalerts.service;

import java.util.Arrays;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.communityalerts.dto.IncidentRequest;
import com.communityalerts.dto.IncidentResponse;
import com.communityalerts.model.Incident;
import com.communityalerts.model.IncidentType;
import com.communityalerts.model.Suburb;
import com.communityalerts.repository.CommentRepository;
import com.communityalerts.repository.IncidentRepository;
import com.communityalerts.repository.SuburbRepository;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class IncidentServiceImpl implements IncidentService {

    private final IncidentRepository incidentRepository;
    private final SuburbRepository   suburbRepository;
    private final CommentRepository  commentRepository;
    private final HeatScoreService   heatScoreService;

    @Override
    @Transactional
    public IncidentResponse create(IncidentRequest request) {
        Suburb suburb = suburbRepository.findById(request.getSuburbId())
            .orElseThrow(() -> new EntityNotFoundException(
                "Suburb not found: " + request.getSuburbId()));

        String tagsString = request.getTags() != null
            ? String.join(",", request.getTags())
            : null;

        Incident incident = Incident.builder()
            .suburb(suburb)
            .type(request.getType())
            .title(request.getTitle())
            .description(request.getDescription())
            .tags(tagsString)
            .severity(request.getSeverity() != null ? request.getSeverity() : 3)
            .latitude(request.getLatitude())
            .longitude(request.getLongitude())
            .build();

        Incident saved = incidentRepository.save(incident);

        // Trigger heat score recalculation for this suburb
        int newScore = heatScoreService.recalculateForSuburb(suburb.getId());
        log.info("Incident created — id={} suburb={} type={} heatScore={}",
            saved.getId(), suburb.getId(), saved.getType(), newScore);

        return toResponse(saved);
    }

    @Override
    public IncidentResponse findById(Long id) {
        return toResponse(incidentRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Incident not found: " + id)));
    }

    @Override
    public Page<IncidentResponse> findAll(Pageable pageable) {
        return incidentRepository.findAll(pageable).map(this::toResponse);
    }

    @Override
    public Page<IncidentResponse> findBySuburb(String suburbId, Pageable pageable) {
        if (!suburbRepository.existsById(suburbId)) {
            throw new EntityNotFoundException("Suburb not found: " + suburbId);
        }
        return incidentRepository
            .findBySuburbIdOrderByCreatedAtDesc(suburbId, pageable)
            .map(this::toResponse);
    }

    @Override
    public Page<IncidentResponse> findByType(IncidentType type, Pageable pageable) {
        return incidentRepository
            .findByTypeOrderByCreatedAtDesc(type, pageable)
            .map(this::toResponse);
    }

    @Override
    public List<IncidentResponse> findNearby(double lat, double lng, double radiusKm) {
        return incidentRepository.findWithinRadius(lat, lng, radiusKm)
            .stream()
            .map(this::toResponse)
            .toList();
    }

    @Override
    public List<com.communityalerts.dto.IncidentMapDTO> findAllMapData() {
        return incidentRepository.findAllMapData();
    }


    @Override
    @Transactional
    public void delete(Long id) {
        Incident incident = incidentRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Incident not found: " + id));
        String suburbId = incident.getSuburb().getId();
        incidentRepository.delete(incident);
        heatScoreService.recalculateForSuburb(suburbId);
    }

    // ── Mapping ──────────────────────────────────────────────────────────────

    private IncidentResponse toResponse(Incident i) {
        List<String> tags = (i.getTags() != null && !i.getTags().isBlank())
            ? Arrays.asList(i.getTags().split(","))
            : List.of();

        return new IncidentResponse(
            i.getId(),
            i.getSuburb().getId(),
            i.getSuburb().getName(),
            i.getType(),
            i.getType().toDisplayLabel(),
            i.getTitle(),
            i.getDescription(),
            tags,
            i.getSeverity(),
            i.getLatitude(),
            i.getLongitude(),
            i.getCreatedAt(),
            commentRepository.countByIncidentId(i.getId())
        );
    }
}
