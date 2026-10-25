using AlertProcessor.Domain;

namespace AlertProcessor.Geo;

public static class GeoMath
{
    private const double EarthRadiusMeters = 6_371_000.0;

    /// <summary>Great-circle (haversine) distance between two coordinates.</summary>
    public static double DistanceMeters(double lat1, double lng1, double lat2, double lng2)
    {
        var dLat = ToRadians(lat2 - lat1);
        var dLng = ToRadians(lng2 - lng1);

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                + Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2))
                * Math.Sin(dLng / 2) * Math.Sin(dLng / 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return EarthRadiusMeters * c;
    }

    /// <summary>
    /// Ray-casting point-in-polygon test on (lng, lat) treated as planar x/y,
    /// which is accurate at watch-zone scale (at most 10 km across).
    /// </summary>
    public static bool ContainsPoint(IReadOnlyList<GeoPoint> polygon, double lat, double lng)
    {
        ArgumentNullException.ThrowIfNull(polygon);

        var inside = false;
        for (int i = 0, j = polygon.Count - 1; i < polygon.Count; j = i++)
        {
            var a = polygon[i];
            var b = polygon[j];
            var crosses = (a.Lat > lat) != (b.Lat > lat)
                          && lng < (b.Lng - a.Lng) * (lat - a.Lat) / (b.Lat - a.Lat) + a.Lng;
            if (crosses)
            {
                inside = !inside;
            }
        }

        return inside;
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180.0;
}
