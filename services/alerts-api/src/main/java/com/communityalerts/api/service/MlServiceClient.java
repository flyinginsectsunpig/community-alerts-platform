package com.communityalerts.api.service;

import com.communityalerts.api.dto.SeverityPreview;
import com.communityalerts.api.error.ServiceUnavailableException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Map;

/**
 * Thin proxy to the Python ML service. Keeping this hop server-side means the
 * ML service never needs public ingress or its own CORS policy.
 */
@Component
public class MlServiceClient {

    private final RestClient restClient;

    public MlServiceClient(@Value("${app.ml.base-url}") String baseUrl, RestClient.Builder builder) {
        this.restClient = builder.baseUrl(baseUrl).build();
    }

    /** Returns the hotspot GeoJSON-ish payload verbatim; the ML service owns its shape. */
    public String fetchHotspots(int windowHours) {
        try {
            return restClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/hotspots")
                            .queryParam("windowHours", windowHours)
                            .build())
                    .retrieve()
                    .body(String.class);
        } catch (RestClientException e) {
            throw new ServiceUnavailableException("Hotspot analysis is temporarily unavailable", e);
        }
    }

    public SeverityPreview previewSeverity(String text) {
        try {
            return restClient.post()
                    .uri("/severity/preview")
                    .body(Map.of("text", text))
                    .retrieve()
                    .body(SeverityPreview.class);
        } catch (RestClientException e) {
            throw new ServiceUnavailableException("Severity preview is temporarily unavailable", e);
        }
    }
}
