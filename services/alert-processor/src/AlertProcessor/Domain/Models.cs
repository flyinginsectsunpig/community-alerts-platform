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

/// <summary>The slice of an alert's current state needed to decide on an ongoing-danger warning.</summary>
public sealed record AlertState(Guid Id, string Category, string Status, bool Ongoing, DateTimeOffset CreatedAt);

/// <summary>A user who opted in to ongoing-danger warnings, with their reach and watch zones.</summary>
public sealed record DangerWatcher(Guid UserId, int ReachM, IReadOnlyList<WatchZone> Zones);

/// <summary>The zone to warn a watcher through, and how far the alert is from its edge.</summary>
public sealed record DangerTarget(WatchZone Zone, double EdgeDistanceMeters);

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
