using System.Net.Http.Json;
using AlertProcessor.Data;
using AlertProcessor.Domain;
using Microsoft.Extensions.Logging;

namespace AlertProcessor.Notifications;

/// <summary>
/// Persists notifications for matched watch zones (served to users by the
/// API), emails the zone contact via Resend when the zone has one, and, for
/// escalations, POSTs to the optional webhook (e.g. Slack). Inserts are
/// idempotent per (zone, alert, kind); emails fire only on a fresh insert so
/// AMQP redeliveries never double-send.
/// </summary>
public sealed class NotificationDispatcher(
    INotificationRepository notificationRepository,
    IEmailSender emailSender,
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

                if (!string.IsNullOrWhiteSpace(match.Zone.ContactEmail))
                {
                    var (subject, html) = EmailComposer.ZoneMatch(alert, match);
                    await emailSender.SendAsync(match.Zone.ContactEmail, subject, html, ct);
                }
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
                if (!string.IsNullOrWhiteSpace(match.Zone.ContactEmail))
                {
                    var (subject, html) = EmailComposer.Escalation(alert, match);
                    await emailSender.SendAsync(match.Zone.ContactEmail, subject, html, ct);
                }
            }
        }

        await PostWebhookAsync(alert, matches.Count, ct);
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
