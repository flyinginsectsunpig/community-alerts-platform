package com.communityalerts.api.dto;

import com.communityalerts.api.domain.PoliceStation;

public record StationResponse(long id, String name, String district, String province,
                              double lat, double lng) {

    public static StationResponse from(PoliceStation station) {
        return new StationResponse(station.getId(), station.getName(), station.getDistrict(),
                station.getProvince(), station.getLat(), station.getLng());
    }
}
