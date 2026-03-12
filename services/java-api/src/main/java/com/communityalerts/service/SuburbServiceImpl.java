package com.communityalerts.service;

import com.communityalerts.dto.SuburbResponse;
import com.communityalerts.model.Suburb;
import com.communityalerts.repository.IncidentRepository;
import com.communityalerts.repository.SuburbRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
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
    @Cacheable(value = "suburbs")
    public List<SuburbResponse> findAll() {
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
        
        List<Object[]> queryResults = incidentRepository.countRecentBySuburb(thirtyDaysAgo);
        java.util.Map<String, Long> incidentCounts = queryResults.stream()
            .collect(java.util.stream.Collectors.toMap(
                row -> (String) row[0],
                row -> (Long) row[1]
            ));

        return suburbRepository.findAll()
            .stream()
            .map(suburb -> toResponse(suburb, incidentCounts.getOrDefault(suburb.getId(), 0L).intValue()))
            .sorted((a, b) -> b.heatScore() - a.heatScore())  // hottest first
            .toList();
    }

    @Override
    public SuburbResponse findById(String id) {
        Suburb suburb = suburbRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Suburb not found: " + id));
            
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
        int incidentCount = incidentRepository.findRecentBySuburb(id, thirtyDaysAgo).size();
        
        return toResponse(suburb, incidentCount);
    }

    @Override
    @Transactional
    @CacheEvict(value = "suburbs", allEntries = true)
    public SuburbResponse refreshHeatScore(String id) {
        heatScoreService.recalculateForSuburb(id);
        return findById(id);
    }

    // ── Mapping ──────────────────────────────────────────────────────────────

    private SuburbResponse toResponse(Suburb suburb, int incidentCount) {
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

