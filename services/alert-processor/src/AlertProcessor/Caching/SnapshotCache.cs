using System.Text.Json;
using AlertProcessor.Domain;
using StackExchange.Redis;

namespace AlertProcessor.Caching;

public interface ISnapshotCache
{
    Task SetStatsAsync(StatsSnapshot snapshot, CancellationToken ct);
}

/// <summary>
/// Publishes the precomputed 7-day stats snapshot to Upstash Redis where the
/// Java API serves it from (key <c>stats:7d</c>). No TTL — the worker
/// overwrites it on every alert, and the API falls back to SQL if it is absent.
/// </summary>
public sealed class RedisSnapshotCache(IConnectionMultiplexer redis) : ISnapshotCache
{
    public const string StatsKey = "stats:7d";

    public async Task SetStatsAsync(StatsSnapshot snapshot, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        var payload = JsonSerializer.Serialize(snapshot, JsonDefaults.Options);
        await redis.GetDatabase().StringSetAsync(StatsKey, payload);
    }
}
