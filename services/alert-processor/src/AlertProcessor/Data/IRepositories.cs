using AlertProcessor.Domain;

namespace AlertProcessor.Data;

public interface IWatchZoneRepository
{
    Task<IReadOnlyList<WatchZone>> GetAllAsync(CancellationToken ct);
}

public interface INotificationRepository
{
    /// <returns>1 if a row was inserted, 0 if it already existed (idempotent).</returns>
    Task<int> InsertAsync(Guid watchZoneId, Guid alertId, string kind, string message, CancellationToken ct);
}

public interface IStatsRepository
{
    Task<IReadOnlyList<CountRow>> GetCategoryCountsAsync(DateTimeOffset since, CancellationToken ct);
    Task<IReadOnlyList<DayCount>> GetDailyCountsAsync(DateTimeOffset since, CancellationToken ct);
    Task<IReadOnlyList<CountRow>> GetSeverityCountsAsync(DateTimeOffset since, CancellationToken ct);
}
