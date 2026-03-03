package com.communityalerts.service;

import com.communityalerts.dto.IncidentRequest;
import com.communityalerts.dto.IncidentResponse;
import com.communityalerts.model.IncidentType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface IncidentService {

    IncidentResponse create(IncidentRequest request);

    IncidentResponse findById(Long id);

    Page<IncidentResponse> findAll(Pageable pageable);

    Page<IncidentResponse> findBySuburb(String suburbId, Pageable pageable);

    Page<IncidentResponse> findByType(IncidentType type, Pageable pageable);

    List<IncidentResponse> findNearby(double lat, double lng, double radiusKm);

    void delete(Long id);
}
