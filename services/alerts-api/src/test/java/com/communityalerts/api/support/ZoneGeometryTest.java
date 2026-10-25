package com.communityalerts.api.support;

import com.communityalerts.api.dto.ZonePoint;
import com.communityalerts.api.error.BadRequestException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.data.Offset.offset;

class ZoneGeometryTest {

    private static final double LAT = 51.5074;
    private static final double LNG = -0.1278;
    private static final double METRES_PER_DEG_LAT = Math.PI / 180 * 6_371_000;
    private static final double METRES_PER_DEG_LNG = METRES_PER_DEG_LAT * Math.cos(Math.toRadians(LAT));

    private static ZonePoint point(double eastM, double northM) {
        return new ZonePoint(LAT + northM / METRES_PER_DEG_LAT, LNG + eastM / METRES_PER_DEG_LNG);
    }

    /** Corners in the order NW, NE, SE, SW. */
    private static List<ZonePoint> rectangle(double widthM, double heightM) {
        double w = widthM / 2;
        double h = heightM / 2;
        return List.of(point(-w, h), point(w, h), point(w, -h), point(-w, -h));
    }

    private static List<ZonePoint> square(double sideM) {
        return rectangle(sideM, sideM);
    }

    private static List<ZonePoint> circle(int points, double radiusM) {
        List<ZonePoint> ring = new ArrayList<>();
        for (int i = 0; i < points; i++) {
            double angle = 2 * Math.PI * i / points;
            ring.add(point(radiusM * Math.cos(angle), radiusM * Math.sin(angle)));
        }
        return ring;
    }

    @Test
    @DisplayName("a square summarises to its centre and the furthest corner")
    void squareSummarisesToCentreAndFurthestPoint() {
        ZoneGeometry.Summary summary = ZoneGeometry.summarize(square(1000));

        assertThat(summary.centerLat()).isCloseTo(LAT, offset(1e-6));
        assertThat(summary.centerLng()).isCloseTo(LNG, offset(1e-6));
        assertThat(summary.radiusM()).isBetween(706, 709);
    }

    @Test
    @DisplayName("fewer than three points is rejected")
    void rejectsFewerThanThreePoints() {
        List<ZonePoint> two = List.of(point(0, 0), point(500, 500));

        assertThatThrownBy(() -> ZoneGeometry.summarize(two))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("A drawn zone needs at least 3 points");
    }

    @Test
    @DisplayName("more than 500 points is rejected")
    void rejectsMoreThan500Points() {
        List<ZonePoint> ring = circle(501, 2000);

        assertThatThrownBy(() -> ZoneGeometry.summarize(ring))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("A drawn zone can have at most 500 points");
    }

    @Test
    @DisplayName("exactly 500 points is accepted")
    void accepts500Points() {
        assertThat(ZoneGeometry.summarize(circle(500, 2000)).radiusM()).isBetween(1999, 2002);
    }

    @Test
    @DisplayName("an outline whose edges cross is rejected")
    void rejectsCrossingEdges() {
        List<ZonePoint> s = square(1000);
        List<ZonePoint> bowTie = List.of(s.get(0), s.get(2), s.get(1), s.get(3));

        assertThatThrownBy(() -> ZoneGeometry.summarize(bowTie))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("A drawn zone's edges must not cross");
    }

    @Test
    @DisplayName("a shape reaching beyond 10 km from its centre is rejected")
    void rejectsShapeBeyond10km() {
        // equilateral, 20 km sides: each vertex is ~11.5 km from the centroid
        double h = 20_000 * Math.sqrt(3) / 2;
        List<ZonePoint> triangle = List.of(point(-10_000, -h / 3), point(10_000, -h / 3), point(0, 2 * h / 3));

        assertThatThrownBy(() -> ZoneGeometry.summarize(triangle))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("A drawn zone must fit within 10 km of its centre");
    }

    @Test
    @DisplayName("a shape that never reaches 50 m from its centre is rejected")
    void rejectsShapeUnder50m() {
        assertThatThrownBy(() -> ZoneGeometry.summarize(square(60)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("A drawn zone must reach at least 50 m from its centre");
    }

    @Test
    @DisplayName("a thin street-shaped outline is accepted")
    void acceptsThinStreet() {
        ZoneGeometry.Summary summary = ZoneGeometry.summarize(rectangle(400, 20));

        assertThat(summary.radiusM()).isBetween(199, 202);
    }

    @Test
    @DisplayName("a missing outline is treated as too few points")
    void rejectsNull() {
        assertThatThrownBy(() -> ZoneGeometry.summarize(null))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("A drawn zone needs at least 3 points");
    }
}
