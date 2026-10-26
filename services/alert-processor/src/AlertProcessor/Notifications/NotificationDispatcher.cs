using System.Net.Http.Json;
using AlertProcessor.Data;
using AlertProcessor.Domain;
using Microsoft.Extensions.Logging;

namespace AlertProcessor.Notifications;

/// <summary>
/// Persists notifications for matched watch zones (served to users by the
/// API), delivers a browser push to the zone owner's subscribed devices, and,
/// for escalations, POSTs to the optional webhook (e.g. Slack). Ongoing-danger
/// warnings are push-only (no webhook). Inserts are
/// idempotent per (zone, alert, kind); pushes fire only on a fresh insert so
/// AMQP redeliveries never double-send. Zone-hit email was retired in favour
/// of push + account digests.
/// </summary>
public sealed class NotificationDispatcher(
    INotificationRepository notificationRepository,
    IPushSubscriptionRepository pushSubscriptions,
    IPushSender pushSender,
    HttpClient httpClient,
    WorkerOptions options,
    ILogger<NotificationDispatcher> logger)
{
    public const string KindZoneMatch = "ZONE_MATCH";
    public const string KindEscalation = "ESCALATION";
    public const string KindDangerNearby = "DANGER_NEARBY";

    public async Task DispatchZoneMatchesAsync(
        AlertCreatedEvent alert, IReadOnlyList<ZoneMatch> matches, CancellationToken ct)
    {
        foreach (var match in matches)
        {
            var message = match.Zone.Polygon is null
                ? $"New {EmailComposer.Humanize(alert.Category)} report " +
                  $"{Math.Round(match.DistanceMeters)} m from your watch zone '{match.Zone.Name}'."
                : $"New {EmailComposer.Humanize(alert.Category)} report " +
                  $"inside your watch zone '{match.Zone.Name}'.";

            var inserted = await notificationRepository.InsertAsync(
                match.Zone.Id, alert.AlertId, KindZoneMatch, message, ct);

            if (inserted > 0)
            {
                if (match.Zone.Polygon is null)
                {
                    logger.LogInformation(
                        "Notified zone {ZoneName} about alert {AlertId} ({Distance} m away)",
                        match.Zone.Name, alert.AlertId, Math.Round(match.DistanceMeters));
                }
                else
                {
                    logger.LogInformation(
                        "Notified zone {ZoneName} about alert {AlertId} (inside drawn zone)",
                        match.Zone.Name, alert.AlertId);
                }

                await PushToZoneAsync(
                    match.Zone, $"Alert near '{match.Zone.Name}'", message, alert.AlertId, ct);
            }
        }
    }

    public async Task DispatchEscalationsAsync(
        AlertScoredEvent alert, IReadOnlyList<ZoneMatch> matches, CancellationToken ct)
    {
        foreach (var match in matches)
        {
            var message = match.Zone.Polygon is null
                ? $"{alert.Severity} severity {EmailComposer.Humanize(alert.Category)} alert " +
                  $"{Math.Round(match.DistanceMeters)} m from your watch zone '{match.Zone.Name}' " +
                  $"(risk score {alert.RiskScore:0.00})."
                : $"{alert.Severity} severity {EmailComposer.Humanize(alert.Category)} alert " +
                  $"inside your watch zone '{match.Zone.Name}' " +
                  $"(risk score {alert.RiskScore:0.00}).";

            var inserted = await notificationRepository.InsertAsync(
                match.Zone.Id, alert.AlertId, KindEscalation, message, ct);

            if (inserted > 0)
            {
                await PushToZoneAsync(
                    match.Zone, $"{alert.Severity} alert near '{match.Zone.Name}'",
                    message, alert.AlertId, ct);
            }
        }

        await PostWebhookAsync(alert, matches.Count, ct);
    }

    /// <summary>
    /// Warns zone owners that an ongoing incident is near (but outside) their
    /// zone. Push-only: no webhook, and a redelivery inserts nothing so never
    /// pushes twice.
    /// </summary>
    public async Task DispatchDangerWarningsAsync(
        AlertScoredEvent alert,
        DateTimeOffset reportedAt,
        IReadOnlyList<DangerTarget> targets,
        DateTimeOffset now,
        CancellationToken ct)
    {
        var label = alert.Category switch
        {
            "ASSAULT" => "Assault",
            "HAZARD" => "Hazard",
            _ => "Incident",
        };
        var minutes = Math.Max(1, (int)(now - reportedAt).TotalMinutes);

        foreach (var target in targets)
        {
            var title =
                $"Avoid area: ongoing incident {EmailComposer.FormatDistance(target.EdgeDistanceMeters)} " +
                $"from '{target.Zone.Name}'";
            var body = $"{label} reported {minutes} min ago, still in progress. Consider another route.";

            var inserted = await notificationRepository.InsertAsync(
                target.Zone.Id, alert.AlertId, KindDangerNearby, $"{title}. {body}", ct);

            if (inserted > 0)
            {
                await PushToZoneAsync(target.Zone, title, body, alert.AlertId, ct);
            }
        }
    }

    /// <summary>Best-effort: a push failure never fails the durable notification.</summary>
    private async Task PushToZoneAsync(
        WatchZone zone, string title, string body, Guid alertId, CancellationToken ct)
    {
        if (!pushSender.Enabled)
        {
            return;
        }

        foreach (var subscription in await pushSubscriptions.GetForZoneAsync(zone.Id, ct))
        {
            var result = await pushSender.SendAsync(subscription, title, body, alertId, ct);
            if (result == PushSendResult.Gone)
            {
                await pushSubscriptions.DeleteAsync(subscription.Endpoint, ct);
            }
        }
    }

    private async Task PostWebhookAsync(AlertScoredEvent alert, int zonesNotified, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(options.NotificationWebhookUrl))
        {
            return;
        }

        try
        {
            var payload = new
            {
                text = $":rotating_light: {alert.Severity} alert {alert.AlertId} " +
                       $"({EmailComposer.Humanize(alert.Category)}, risk {alert.RiskScore:0.00}) " +
                       $"at {alert.Lat:0.#####},{alert.Lng:0.#####} — {zonesNotified} watch zone(s) notified.",
            };
            using var response = await httpClient.PostAsJsonAsync(options.NotificationWebhookUrl, payload, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Escalation webhook returned {StatusCode}", (int)response.StatusCode);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // The webhook is best-effort; the durable notification rows are the source of truth.
            logger.LogWarning(ex, "Escalation webhook delivery failed");
        }
    }
}
