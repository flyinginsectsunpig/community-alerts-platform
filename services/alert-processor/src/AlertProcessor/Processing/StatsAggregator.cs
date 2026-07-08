using AlertProcessor.Caching;
using AlertProcessor.Data;
using AlertProcessor.Domain;

namespace AlertProcessor.Processing;

/// <summary>
/// Maintains the 7-day statistics snapshot the dashboard's stats panel reads
/// (via the Java API) from Redis. Recomputed after every ingested alert.
/// </summary>
public sealed class StatsAggregator(
    IStatsRepository statsRepository,
    ISnapshotCache snapshotCache,
    TimeProvider timeProvider)
{
    private static readonly TimeSpan Window = TimeSpan.FromDays(7);

    public async Task<StatsSnapshot> RecomputeAsync(CancellationToken ct)
    {
        var now = timeProvider.GetUtcNow();
        var since = now - Window;

        var categories = await statsRepository.GetCategoryCountsAsync(since, ct);
        var days = await statsRepository.GetDailyCountsAsync(since, ct);
        var severities = await statsRepository.GetSeverityCountsAsync(since, ct);

        var snapshot = BuildSnapshot(categories, days, severities, now);
        await snapshotCache.SetStatsAsync(snapshot, ct);
        return snapshot;
    }

    /// <summary>Pure aggregation step, unit-tested in isolation.</summary>
    public static StatsSnapshot BuildSnapshot(
        IReadOnlyList<CountRow> categories,
        IReadOnlyList<DayCount> days,
        IReadOnlyList<CountRow> severities,
        DateTimeOffset generatedAtUtc)
    {
        var byCategory = categories.ToDictionary(row => row.Key, row => row.Count);
        var bySeverity = severities.ToDictionary(row => row.Key, row => row.Count);
        var total = categories.Sum(row => row.Count);

        return new StatsSnapshot(total, byCategory, days, bySeverity, generatedAtUtc);
    }
}
