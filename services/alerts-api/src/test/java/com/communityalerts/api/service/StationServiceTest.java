package com.communityalerts.api.service;

import com.communityalerts.api.domain.PoliceStation;
import com.communityalerts.api.dto.StationResponse;
import com.communityalerts.api.error.BadRequestException;
import com.communityalerts.api.repository.PoliceStationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationServiceTest {

    @Mock
    private PoliceStationRepository repository;
    @Mock
    private StringRedisTemplate redis;
    @Mock
    private ValueOperations<String, String> valueOperations;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private StationService stationService;

    @BeforeEach
    void setUp() {
        stationService = new StationService(repository, redis, objectMapper);
    }

    private static PoliceStation station(long id, String name) {
        PoliceStation s = new PoliceStation();
        s.setId(id);
        s.setName(name);
        s.setDistrict("Ehlanzeni District");
        s.setProvince("Mpumalanga");
        s.setLat(-24.6);
        s.setLng(31.1);
        return s;
    }

    @Test
    @DisplayName("inverted or out-of-range bounds are rejected before touching the database")
    void invalidBoundsRejected() {
        assertThatThrownBy(() -> stationService.findInBounds(10, 5, 0, 1))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> stationService.findInBounds(-91, 5, 0, 1))
                .isInstanceOf(BadRequestException.class);
        verify(repository, never()).findInBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble());
    }

    @Test
    @DisplayName("cache miss queries the database and writes the cache with a 1h TTL")
    void cacheMissFallsThrough() {
        when(redis.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);
        when(repository.findInBounds(-25.0, -24.0, 31.0, 32.0))
                .thenReturn(List.of(station(1, "Acornhoek")));

        List<StationResponse> result = stationService.findInBounds(-25.0, -24.0, 31.0, 32.0);

        assertThat(result).containsExactly(
                new StationResponse(1, "Acornhoek", "Ehlanzeni District", "Mpumalanga", -24.6, 31.1));
        verify(valueOperations).set(startsWith("stations:bbox:"), anyString(),
                eq(StationService.CACHE_TTL));
    }

    @Test
    @DisplayName("cache hit never touches the database")
    void cacheHitSkipsDatabase() throws Exception {
        List<StationResponse> cached = List.of(
                new StationResponse(1, "Acornhoek", "Ehlanzeni District", "Mpumalanga", -24.6, 31.1));
        when(redis.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(objectMapper.writeValueAsString(cached));

        assertThat(stationService.findInBounds(-25.0, -24.0, 31.0, 32.0)).isEqualTo(cached);
        verify(repository, never()).findInBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble());
    }

    @Test
    @DisplayName("a Redis outage falls back to the database (fail open)")
    void redisOutageFailsOpen() {
        when(redis.opsForValue()).thenThrow(new RuntimeException("redis down"));
        when(repository.findInBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(List.of(station(1, "Acornhoek")));

        assertThat(stationService.findInBounds(-25.0, -24.0, 31.0, 32.0)).hasSize(1);
    }
}
