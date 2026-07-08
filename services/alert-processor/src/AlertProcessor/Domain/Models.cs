namespace AlertProcessor.Domain;

public sealed record WatchZone(
    Guid Id,
    string Name,
    string ContactEmail,
    double CenterLat,
    double CenterLng,
    int RadiusM,
    IReadOnlyList<string> Categories);

public sealed record ZoneMatch(WatchZone Zone, double DistanceMeters);

public sealed record CountRow(string Key, long Count);

public sealed record DayCount(string Day, long Count);

/// <summary>
/// Serialized (camelCase) into Redis under <c>stats:7d</c>; the Java API's
/// StatsSnapshot record deserializes the same shape. Keep the fields in sync.
/// </summary>
public sealed record StatsSnapshot(
    long Total,
    IReadOnlyDictionary<string, long> ByCategory,
    IReadOnlyList<DayCount> ByDay,
    IReadOnlyDictionary<string, long> BySeverity,
    DateTimeOffset GeneratedAtUtc);
