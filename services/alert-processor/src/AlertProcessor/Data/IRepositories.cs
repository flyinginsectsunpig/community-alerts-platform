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

public interface IPushSubscriptionRepository
{
    /// <summary>Subscriptions belonging to the zone's owner (account or fingerprint).</summary>
    Task<IReadOnlyList<PushSubscriptionRow>> GetForZoneAsync(Guid zoneId, CancellationToken ct);

    /// <summary>Removes a subscription the push service reported gone (404/410).</summary>
    Task DeleteAsync(string endpoint, CancellationToken ct);
}

public interface IAlertExpiryRepository
{
    /// <summary>Flips overdue ACTIVE/VERIFIED alerts to EXPIRED and returns them.</summary>
    Task<IReadOnlyList<ExpiredAlert>> ExpireOverdueAsync(CancellationToken ct);
}

public interface IStatsRepository
{
    Task<IReadOnlyList<CountRow>> GetCategoryCountsAsync(DateTimeOffset since, CancellationToken ct);
    Task<IReadOnlyList<DayCount>> GetDailyCountsAsync(DateTimeOffset since, CancellationToken ct);
    Task<IReadOnlyList<CountRow>> GetSeverityCountsAsync(DateTimeOffset since, CancellationToken ct);
}
