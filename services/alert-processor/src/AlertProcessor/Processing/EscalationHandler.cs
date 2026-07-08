using AlertProcessor.Data;
using AlertProcessor.Notifications;
using Microsoft.Extensions.Logging;

namespace AlertProcessor.Processing;

/// <summary>
/// Handles <c>alert.scored</c>: when the ML service flags an alert as
/// dangerous, notify a widened area (2x every zone's radius) regardless of
/// the categories each zone subscribed to.
/// </summary>
public sealed class EscalationHandler(
    IWatchZoneRepository watchZoneRepository,
    WatchZoneMatcher matcher,
    NotificationDispatcher dispatcher,
    ILogger<EscalationHandler> logger)
{
    internal const double EscalationRadiusMultiplier = 2.0;
    internal const double HighSeverityRiskThreshold = 0.72;

    public async Task HandleAsync(AlertScoredEvent alert, CancellationToken ct)
    {
        if (!IsEscalatable(alert))
        {
            return;
        }

        var zones = await watchZoneRepository.GetAllAsync(ct);
        var matches = matcher.FindMatches(
            zones, alert.Lat, alert.Lng, alert.Category,
            radiusMultiplier: EscalationRadiusMultiplier,
            ignoreCategories: true);

        logger.LogWarning(
            "Escalating {Severity} alert {AlertId} (risk {RiskScore}) to {ZoneCount} zones",
            alert.Severity, alert.AlertId, alert.RiskScore, matches.Count);

        await dispatcher.DispatchEscalationsAsync(alert, matches, ct);
    }

    internal static bool IsEscalatable(AlertScoredEvent alert) =>
        alert.Severity == "CRITICAL"
        || (alert.Severity == "HIGH" && alert.RiskScore >= HighSeverityRiskThreshold);
}
