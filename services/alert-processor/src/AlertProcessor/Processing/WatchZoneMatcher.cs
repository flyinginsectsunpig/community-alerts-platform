using AlertProcessor.Domain;
using AlertProcessor.Geo;

namespace AlertProcessor.Processing;

/// <summary>
/// Pure geo-matching logic: which watch zones should hear about an alert at a
/// given location. Deliberately side-effect free so it is trivially testable.
/// </summary>
public sealed class WatchZoneMatcher
{
    /// <param name="radiusMultiplier">
    /// Scales each zone's radius; escalations use &gt; 1 to widen the blast radius.
    /// </param>
    /// <param name="ignoreCategories">
    /// When true, category subscriptions are bypassed (public-safety broadcasts).
    /// </param>
    public IReadOnlyList<ZoneMatch> FindMatches(
        IEnumerable<WatchZone> zones,
        double lat,
        double lng,
        string category,
        double radiusMultiplier = 1.0,
        bool ignoreCategories = false)
    {
        ArgumentNullException.ThrowIfNull(zones);
        ArgumentException.ThrowIfNullOrWhiteSpace(category);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(radiusMultiplier);

        return zones
            .Where(zone => ignoreCategories
                           || zone.Categories.Count == 0
                           || zone.Categories.Contains(category, StringComparer.OrdinalIgnoreCase))
            .Select(zone => new ZoneMatch(
                zone,
                GeoMath.DistanceMeters(zone.CenterLat, zone.CenterLng, lat, lng)))
            .Where(match => match.DistanceMeters <= match.Zone.RadiusM * radiusMultiplier)
            .OrderBy(match => match.DistanceMeters)
            .ToList();
    }
}
