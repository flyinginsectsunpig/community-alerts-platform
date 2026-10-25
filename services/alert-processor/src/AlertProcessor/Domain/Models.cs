namespace AlertProcessor.Domain;

/// <summary>A vertex of a drawn watch zone outline.</summary>
public sealed record GeoPoint(double Lat, double Lng);

/// <summary>
/// A user's watch zone. Circle zones leave <paramref name="Polygon"/> null and
/// match by <paramref name="RadiusM"/>; drawn zones carry their outline and
/// match by point-in-polygon (centre and radius are then just a summary).
/// </summary>
public sealed record WatchZone(
    Guid Id,
    string Name,
    string? ContactEmail,
    double CenterLat,
    double CenterLng,
    int RadiusM,
    IReadOnlyList<string> Categories,
    IReadOnlyList<GeoPoint>? Polygon = null);

public sealed record ZoneMatch(WatchZone Zone, double DistanceMeters);

/// <summary>A browser push target for a zone owner's device.</summary>
public sealed record PushSubscriptionRow(long Id, string Endpoint, string P256dh, string Auth);

/// <summary>One zone notification joined to its opted-in account, for digests.</summary>
public sealed record DigestRow(string Email, string ZoneName, string Message, DateTimeOffset CreatedAt);

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
