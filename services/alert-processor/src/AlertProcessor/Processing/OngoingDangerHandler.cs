using AlertProcessor.Data;
using AlertProcessor.Notifications;
using Microsoft.Extensions.Logging;

namespace AlertProcessor.Processing;

/// <summary>
/// Handles <c>alert.scored</c> on its own queue: when an incident is still
/// happening, warn opted-in users whose zones are within their chosen reach.
/// Runs apart from <see cref="EscalationHandler"/> so a failure here can't
/// dead-letter the escalation.
/// </summary>
public sealed class OngoingDangerHandler(
    IDangerWatchRepository repository,
    NotificationDispatcher dispatcher,
    TimeProvider timeProvider,
    ILogger<OngoingDangerHandler> logger)
{
    public async Task HandleAsync(AlertScoredEvent alert, CancellationToken ct)
    {
        // Cheap event-level gate before any DB read; Qualifies stays the
        // authoritative check on the stored alert state.
        if (alert.Severity != "CRITICAL" || !OngoingDanger.IsEligibleCategory(alert.Category))
        {
            return;
        }

        var state = await repository.GetAlertStateAsync(alert.AlertId, ct);
        if (state is null)
        {
            logger.LogWarning(
                "Alert {AlertId} not found for ongoing-danger check; skipping", alert.AlertId);
            return;
        }

        var now = timeProvider.GetUtcNow();
        if (!OngoingDanger.Qualifies(alert, state, now))
        {
            return;
        }

        var watchers = await repository.GetDangerWatchersAsync(ct);
        var targets = OngoingDanger.SelectTargets(watchers, alert.Lat, alert.Lng, alert.Category);
        if (targets.Count == 0)
        {
            return;
        }

        logger.LogWarning(
            "Warning {TargetCount} users about ongoing {Category} alert {AlertId}",
            targets.Count, state.Category, alert.AlertId);

        await dispatcher.DispatchDangerWarningsAsync(alert, state.CreatedAt, targets, now, ct);
    }
}
