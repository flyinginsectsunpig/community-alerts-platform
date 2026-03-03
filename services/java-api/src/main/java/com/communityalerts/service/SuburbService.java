package com.communityalerts.service;

import com.communityalerts.dto.SuburbResponse;

import java.util.List;

public interface SuburbService {
    List<SuburbResponse> findAll();
    SuburbResponse findById(String id);
    SuburbResponse refreshHeatScore(String id);
}
