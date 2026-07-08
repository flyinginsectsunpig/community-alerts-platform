using System.Text.Json;

namespace AlertProcessor;

/// <summary>Published by the Java API on routing key <c>alert.created</c>.</summary>
public sealed record AlertCreatedEvent(
    Guid AlertId,
    string Category,
    string Description,
    double Lat,
    double Lng,
    DateTimeOffset CreatedAt);

/// <summary>Published by the Python ML service on routing key <c>alert.scored</c>.</summary>
public sealed record AlertScoredEvent(
    Guid AlertId,
    string Severity,
    double RiskScore,
    string ModelVersion,
    string Category,
    double Lat,
    double Lng,
    DateTimeOffset ScoredAt);

public static class JsonDefaults
{
    /// <summary>camelCase + case-insensitive, matching the Java and Python services.</summary>
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
}
