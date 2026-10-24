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
/// Java API serves it from (key <c>stats:7d</c>).
///
/// <para>The key carries a lifetime. It used to be written with none, on the
/// reasoning that every ingested alert overwrites it — but nothing else
/// recomputes it, so a week without a report left the dashboard serving a
/// snapshot whose 7-day window had rolled past, labelled "live". Letting it
/// expire hands the API back to its SQL fallback, which is always current.</para>
/// </summary>
public sealed class RedisSnapshotCache(IConnectionMultiplexer redis, WorkerOptions options)
    : ISnapshotCache
{
    public const string StatsKey = "stats:7d";

    public async Task SetStatsAsync(StatsSnapshot snapshot, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        var payload = JsonSerializer.Serialize(snapshot, JsonDefaults.Options);
        await redis.GetDatabase().StringSetAsync(StatsKey, payload, options.StatsCacheTtl);
    }
}
