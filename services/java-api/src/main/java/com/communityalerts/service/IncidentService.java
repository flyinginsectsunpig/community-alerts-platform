package com.communityalerts.service;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.communityalerts.dto.IncidentRequest;
import com.communityalerts.dto.IncidentResponse;
import com.communityalerts.model.IncidentType;

public interface IncidentService {

    IncidentResponse create(IncidentRequest request);

    IncidentResponse findById(Long id);

    Page<IncidentResponse> findAll(Pageable pageable);

    Page<IncidentResponse> findBySuburb(String suburbId, Pageable pageable);

    Page<IncidentResponse> findByType(IncidentType type, Pageable pageable);

    List<IncidentResponse> findNearby(double lat, double lng, double radiusKm);

    List<com.communityalerts.dto.IncidentMapDTO> findAllMapData();

    void delete(Long id);
}
