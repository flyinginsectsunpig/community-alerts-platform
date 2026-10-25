package com.communityalerts.api.support;

import com.communityalerts.api.dto.ZonePoint;
import com.communityalerts.api.error.BadRequestException;

import java.util.List;

/**
 * Validates a drawn watch zone outline and reduces it to the centre and
 * radius stored alongside the shape. Mirrors the rules enforced in the web
 * client, so the messages must stay identical.
 */
public final class ZoneGeometry {

    static final int MIN_POINTS = 3;
    static final int MAX_POINTS = 500;
    static final double MAX_REACH_M = 10_000;
    static final double MIN_REACH_M = 50;
    private static final double EARTH_RADIUS_M = 6_371_000;

    /** {@code radiusM} is the distance to the furthest vertex, rounded up. */
    public record Summary(double centerLat, double centerLng, int radiusM) {
    }

    private ZoneGeometry() {
    }

    public static Summary summarize(List<ZonePoint> polygon) {
        if (polygon == null || polygon.size() < MIN_POINTS) {
            throw new BadRequestException("A drawn zone needs at least 3 points");
        }
        if (polygon.size() > MAX_POINTS) {
            throw new BadRequestException("A drawn zone can have at most 500 points");
        }
        if (hasCrossingEdges(polygon)) {
            throw new BadRequestException("A drawn zone's edges must not cross");
        }

        double centerLat = polygon.stream().mapToDouble(ZonePoint::lat).average().orElseThrow();
        double centerLng = polygon.stream().mapToDouble(ZonePoint::lng).average().orElseThrow();
        double reach = polygon.stream()
                .mapToDouble(p -> haversineM(centerLat, centerLng, p.lat(), p.lng()))
                .max().orElseThrow();

        if (reach > MAX_REACH_M) {
            throw new BadRequestException("A drawn zone must fit within 10 km of its centre");
        }
        if (reach < MIN_REACH_M) {
            throw new BadRequestException("A drawn zone must reach at least 50 m from its centre");
        }
        return new Summary(centerLat, centerLng, (int) Math.ceil(reach));
    }

    /** O(n²) over non-adjacent edge pairs; (lng, lat) is treated as planar, fine at these sizes. */
    private static boolean hasCrossingEdges(List<ZonePoint> polygon) {
        int n = polygon.size();
        for (int i = 0; i < n; i++) {
            ZonePoint a = polygon.get(i);
            ZonePoint b = polygon.get((i + 1) % n);
            for (int j = i + 1; j < n; j++) {
                boolean adjacent = j == i + 1 || (i == 0 && j == n - 1);
                if (adjacent) {
                    continue;
                }
                if (segmentsIntersect(a, b, polygon.get(j), polygon.get((j + 1) % n))) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean segmentsIntersect(ZonePoint p1, ZonePoint p2, ZonePoint p3, ZonePoint p4) {
        double d1 = orientation(p3, p4, p1);
        double d2 = orientation(p3, p4, p2);
        double d3 = orientation(p1, p2, p3);
        double d4 = orientation(p1, p2, p4);

        if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
            return true;
        }
        // collinear or touching cases: an endpoint lying on the other segment
        return (d1 == 0 && onSegment(p3, p4, p1))
                || (d2 == 0 && onSegment(p3, p4, p2))
                || (d3 == 0 && onSegment(p1, p2, p3))
                || (d4 == 0 && onSegment(p1, p2, p4));
    }

    /** Cross product of (b - a) x (c - a); sign gives the turn direction. */
    private static double orientation(ZonePoint a, ZonePoint b, ZonePoint c) {
        return (b.lng() - a.lng()) * (c.lat() - a.lat()) - (b.lat() - a.lat()) * (c.lng() - a.lng());
    }

    /** Whether c, already known to be collinear with a-b, lies within its bounding box. */
    private static boolean onSegment(ZonePoint a, ZonePoint b, ZonePoint c) {
        return c.lng() >= Math.min(a.lng(), b.lng()) && c.lng() <= Math.max(a.lng(), b.lng())
                && c.lat() >= Math.min(a.lat(), b.lat()) && c.lat() <= Math.max(a.lat(), b.lat());
    }

    private static double haversineM(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
    }
}
