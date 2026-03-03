package com.communityalerts.service;

import com.communityalerts.dto.SuburbResponse;
import com.communityalerts.model.Suburb;
import com.communityalerts.repository.IncidentRepository;
import com.communityalerts.repository.SuburbRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SuburbServiceImpl implements SuburbService {

    private final SuburbRepository   suburbRepository;
    private final IncidentRepository incidentRepository;
    private final HeatScoreService   heatScoreService;

    @Override
    public List<SuburbResponse> findAll() {
        return suburbRepository.findAll()
            .stream()
            .map(this::toResponse)
            .sorted((a, b) -> b.heatScore() - a.heatScore())  // hottest first
            .toList();
    }

    @Override
    public SuburbResponse findById(String id) {
        return toResponse(suburbRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Suburb not found: " + id)));
    }

    @Override
    @Transactional
    public SuburbResponse refreshHeatScore(String id) {
        heatScoreService.recalculateForSuburb(id);
        return findById(id);
    }

    // ── Mapping ──────────────────────────────────────────────────────────────

    private SuburbResponse toResponse(Suburb suburb) {
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
        int incidentCount = incidentRepository
            .findRecentBySuburb(suburb.getId(), thirtyDaysAgo)
            .size();

        return new SuburbResponse(
            suburb.getId(),
            suburb.getName(),
            suburb.getLatitude(),
            suburb.getLongitude(),
            suburb.getHeatScore(),
            heatScoreService.toAlertLevel(suburb.getHeatScore()),
            incidentCount
        );
    }
}
