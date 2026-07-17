namespace AlertProcessor.Domain;

public sealed record WatchZone(
    Guid Id,
    string Name,
    string? ContactEmail,
    double CenterLat,
    double CenterLng,
    int RadiusM,
    IReadOnlyList<string> Categories);

public sealed record ZoneMatch(WatchZone Zone, double DistanceMeters);

/// <summary>A browser push target for a zone owner's device.</summary>
public sealed record PushSubscriptionRow(long Id, string Endpoint, string P256dh, string Auth);

/// <summary>
/// An alert flipped to EXPIRED by the sweep. Serialized (camelCase) into the
/// <c>alerts.live</c> pub/sub payload; must mirror the Java API's
/// AlertResponse record. Keep the fields in sync.
/// </summary>
public sealed record ExpiredAlert(
    Guid Id,
    string Category,
    string Description,
    double Lat,
    double Lng,
    string Severity,
    double? RiskScore,
    string Status,
    int ConfirmationCount,
    int CommentCount,
    Guid? ReportedByUserId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

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
