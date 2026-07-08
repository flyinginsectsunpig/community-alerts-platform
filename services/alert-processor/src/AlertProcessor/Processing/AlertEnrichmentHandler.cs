using AlertProcessor.Data;
using AlertProcessor.Notifications;
using Microsoft.Extensions.Logging;

namespace AlertProcessor.Processing;

/// <summary>
/// Handles <c>alert.created</c>: matches the alert against every watch zone,
/// persists notifications, and refreshes the 7-day stats snapshot in Redis.
/// </summary>
public sealed class AlertEnrichmentHandler(
    IWatchZoneRepository watchZoneRepository,
    WatchZoneMatcher matcher,
    NotificationDispatcher dispatcher,
    StatsAggregator statsAggregator,
    ILogger<AlertEnrichmentHandler> logger)
{
    public async Task HandleAsync(AlertCreatedEvent alert, CancellationToken ct)
    {
        var zones = await watchZoneRepository.GetAllAsync(ct);
        var matches = matcher.FindMatches(zones, alert.Lat, alert.Lng, alert.Category);

        logger.LogInformation(
            "Alert {AlertId} ({Category}) matched {MatchCount} of {ZoneCount} watch zones",
            alert.AlertId, alert.Category, matches.Count, zones.Count);

        await dispatcher.DispatchZoneMatchesAsync(alert, matches, ct);
        await statsAggregator.RecomputeAsync(ct);
    }
}
