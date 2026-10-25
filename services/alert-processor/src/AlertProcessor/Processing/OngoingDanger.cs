using AlertProcessor.Domain;
using AlertProcessor.Geo;

namespace AlertProcessor.Processing;

/// <summary>
/// Pure rules for ongoing-danger warnings: which incidents qualify, and which
/// opted-in users are near enough (but not already escalated to) to be warned.
/// </summary>
public static class OngoingDanger
{
    internal static readonly TimeSpan OngoingWindow = TimeSpan.FromMinutes(60);

    private static readonly string[] QualifyingCategories = ["ASSAULT", "HAZARD", "OTHER"];

    /// <summary>Whether a category can be a danger still in progress.</summary>
    public static bool IsEligibleCategory(string category) =>
        QualifyingCategories.Contains(category, StringComparer.OrdinalIgnoreCase);

    public static bool Qualifies(AlertScoredEvent scored, AlertState state, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(scored);
        ArgumentNullException.ThrowIfNull(state);

        return state.Ongoing
            && IsEligibleCategory(state.Category)
            && scored.Severity == "CRITICAL"
            && (state.Status == "ACTIVE" || state.Status == "VERIFIED")
            && now - state.CreatedAt <= OngoingWindow;
    }

    /// <summary>Metres from the alert to the zone's edge; 0 when the alert is inside it.</summary>
    public static double EdgeDistanceMeters(WatchZone zone, double lat, double lng)
    {
        ArgumentNullException.ThrowIfNull(zone);

        var centerDistance = GeoMath.DistanceMeters(zone.CenterLat, zone.CenterLng, lat, lng);
        return Math.Max(0, centerDistance - zone.RadiusM);
    }

    public static IReadOnlyList<DangerTarget> SelectTargets(
        IEnumerable<DangerWatcher> watchers, double lat, double lng)
    {
        ArgumentNullException.ThrowIfNull(watchers);

        var targets = new List<DangerTarget>();
        foreach (var watcher in watchers)
        {
            // A qualifying alert is CRITICAL, so EscalationHandler has already
            // notified every zone within 2x its radius; don't warn that user twice.
            var alreadyEscalated = watcher.Zones.Any(z =>
                GeoMath.DistanceMeters(z.CenterLat, z.CenterLng, lat, lng)
                    <= z.RadiusM * EscalationHandler.EscalationRadiusMultiplier);
            if (alreadyEscalated)
            {
                continue;
            }

            DangerTarget? nearest = null;
            foreach (var zone in watcher.Zones)
            {
                var edge = EdgeDistanceMeters(zone, lat, lng);
                if (nearest is null || edge < nearest.EdgeDistanceMeters)
                {
                    nearest = new DangerTarget(zone, edge);
                }
            }

            if (nearest is not null && nearest.EdgeDistanceMeters <= watcher.ReachM)
            {
                targets.Add(nearest);
            }
        }

        return targets.OrderBy(t => t.EdgeDistanceMeters).ToList();
    }
}
