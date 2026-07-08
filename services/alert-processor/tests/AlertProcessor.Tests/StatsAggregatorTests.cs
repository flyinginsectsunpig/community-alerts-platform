using AlertProcessor.Caching;
using AlertProcessor.Data;
using AlertProcessor.Domain;
using AlertProcessor.Processing;
using Xunit;

namespace AlertProcessor.Tests;

public class StatsAggregatorTests
{
    private static readonly DateTimeOffset Now = new(2026, 7, 8, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void BuildSnapshotSumsCategoryCountsIntoTotal()
    {
        var snapshot = StatsAggregator.BuildSnapshot(
            categories: [new CountRow("THEFT", 5), new CountRow("HAZARD", 3)],
            days: [new DayCount("2026-07-07", 6), new DayCount("2026-07-08", 2)],
            severities: [new CountRow("LOW", 7), new CountRow("CRITICAL", 1)],
            generatedAtUtc: Now);

        Assert.Equal(8, snapshot.Total);
        Assert.Equal(5, snapshot.ByCategory["THEFT"]);
        Assert.Equal(2, snapshot.ByDay.Count);
        Assert.Equal(1, snapshot.BySeverity["CRITICAL"]);
        Assert.Equal(Now, snapshot.GeneratedAtUtc);
    }

    [Fact]
    public void BuildSnapshotHandlesEmptyDatabase()
    {
        var snapshot = StatsAggregator.BuildSnapshot([], [], [], Now);

        Assert.Equal(0, snapshot.Total);
        Assert.Empty(snapshot.ByCategory);
        Assert.Empty(snapshot.ByDay);
        Assert.Empty(snapshot.BySeverity);
    }

    [Fact]
    public async Task RecomputeQueriesTheTrailing7DayWindowAndCachesTheResult()
    {
        var repository = new FakeStatsRepository();
        var cache = new FakeSnapshotCache();
        var aggregator = new StatsAggregator(repository, cache, new FixedTimeProvider(Now));

        var snapshot = await aggregator.RecomputeAsync(CancellationToken.None);

        Assert.Equal(Now.AddDays(-7), repository.LastSince);
        Assert.Same(snapshot, cache.LastStored);
        Assert.Equal(4, snapshot.Total);
    }

    private sealed class FakeStatsRepository : IStatsRepository
    {
        public DateTimeOffset? LastSince { get; private set; }

        public Task<IReadOnlyList<CountRow>> GetCategoryCountsAsync(DateTimeOffset since, CancellationToken ct)
        {
            LastSince = since;
            return Task.FromResult<IReadOnlyList<CountRow>>([new CountRow("THEFT", 4)]);
        }

        public Task<IReadOnlyList<DayCount>> GetDailyCountsAsync(DateTimeOffset since, CancellationToken ct) =>
            Task.FromResult<IReadOnlyList<DayCount>>([new DayCount("2026-07-08", 4)]);

        public Task<IReadOnlyList<CountRow>> GetSeverityCountsAsync(DateTimeOffset since, CancellationToken ct) =>
            Task.FromResult<IReadOnlyList<CountRow>>([new CountRow("MEDIUM", 4)]);
    }

    private sealed class FakeSnapshotCache : ISnapshotCache
    {
        public StatsSnapshot? LastStored { get; private set; }

        public Task SetStatsAsync(StatsSnapshot snapshot, CancellationToken ct)
        {
            LastStored = snapshot;
            return Task.CompletedTask;
        }
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
