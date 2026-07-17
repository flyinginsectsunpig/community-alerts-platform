using System.Net.Http.Json;
using AlertProcessor.Data;
using AlertProcessor.Domain;
using Microsoft.Extensions.Logging;

namespace AlertProcessor.Notifications;

/// <summary>
/// Persists notifications for matched watch zones (served to users by the
/// API), delivers a browser push to the zone owner's subscribed devices, and,
/// for escalations, POSTs to the optional webhook (e.g. Slack). Inserts are
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

    public async Task DispatchZoneMatchesAsync(
        AlertCreatedEvent alert, IReadOnlyList<ZoneMatch> matches, CancellationToken ct)
    {
        foreach (var match in matches)
        {
            var message =
                $"New {EmailComposer.Humanize(alert.Category)} report " +
                $"{Math.Round(match.DistanceMeters)} m from your watch zone '{match.Zone.Name}'.";

            var inserted = await notificationRepository.InsertAsync(
                match.Zone.Id, alert.AlertId, KindZoneMatch, message, ct);

            if (inserted > 0)
            {
                logger.LogInformation(
                    "Notified zone {ZoneName} about alert {AlertId} ({Distance} m away)",
                    match.Zone.Name, alert.AlertId, Math.Round(match.DistanceMeters));

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
            var message =
                $"{alert.Severity} severity {EmailComposer.Humanize(alert.Category)} alert " +
                $"{Math.Round(match.DistanceMeters)} m from your watch zone '{match.Zone.Name}' " +
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
