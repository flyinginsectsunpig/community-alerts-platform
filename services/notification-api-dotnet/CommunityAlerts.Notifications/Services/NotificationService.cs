using CommunityAlerts.Notifications.Data;
using CommunityAlerts.Notifications.DTOs;
using CommunityAlerts.Notifications.Models;
using Microsoft.EntityFrameworkCore;

namespace CommunityAlerts.Notifications.Services;

/// <summary>
/// Orchestrates the full notification dispatch pipeline.
///
/// Flow when a suburb crosses an alert threshold:
///   1. Spring Boot calls POST /api/v1/notifications/webhook/suburb-alert
///   2. We find all subscribers watching that suburb at or below the new alert level
///   3. For each subscriber, we dispatch on their preferred channels (email / push)
///   4. Every dispatch is logged to NotificationLog regardless of success
///   5. The count of sent notifications is returned to the caller
///
/// Deduplication: we check the log to ensure we don't re-notify a subscriber
/// about the same suburb at the same level within a 1-hour window.
/// This prevents spam when the heat score oscillates around a threshold.
/// </summary>
public class NotificationService : INotificationService
{
    private readonly NotificationDbContext _db;
    private readonly IEmailService         _email;
    private readonly IPushService          _push;
    private readonly ILogger<NotificationService> _logger;

    private static readonly TimeSpan DeduplicationWindow = TimeSpan.FromHours(1);

    public NotificationService(
        NotificationDbContext db,
        IEmailService   email,
        IPushService    push,
        ILogger<NotificationService> logger)
    {
        _db     = db;
        _email  = email;
        _push   = push;
        _logger = logger;
    }

    public async Task<int> ProcessAlertAsync(
        SuburbAlertWebhookRequest alert,
        CancellationToken ct = default)
    {
        var incomingLevel = AlertLevelExtensions.Parse(alert.AlertLevel);

        _logger.LogInformation(
            "Processing suburb alert: suburb={SuburbId} level={Level} score={Score}",
            alert.SuburbId, alert.AlertLevel, alert.HeatScore);

        // Find subscribers watching this suburb whose minimum threshold is met
        var matchingSubscriptions = await _db.Subscriptions
            .Include(s => s.Subscriber)
            .Where(s =>
                s.SuburbId   == alert.SuburbId        &&
                s.Subscriber.IsActive                 &&
                s.MinimumAlertLevel <= incomingLevel)
            .ToListAsync(ct);

        if (!matchingSubscriptions.Any())
        {
            _logger.LogDebug("No subscribers matched for suburb={SuburbId}", alert.SuburbId);
            return 0;
        }

        int dispatched = 0;

        foreach (var subscription in matchingSubscriptions)
        {
            var subscriber = subscription.Subscriber;

            // Deduplication check — skip if already notified in the last hour
            bool alreadyNotified = await _db.Logs
                .AnyAsync(l =>
                    l.SubscriberId == subscriber.Id   &&
                    l.SuburbId     == alert.SuburbId  &&
                    l.AlertLevel   == alert.AlertLevel &&
                    l.SentAt       >= DateTime.UtcNow - DeduplicationWindow,
                    ct);

            if (alreadyNotified)
            {
                _logger.LogDebug(
                    "Skipping duplicate notification: subscriber={Sub} suburb={Suburb}",
                    subscriber.Username, alert.SuburbId);
                continue;
            }

            // Email
            if (subscription.NotifyByEmail)
            {
                var (subject, body) = BuildEmailContent(alert, incomingLevel);
                bool sent = await _email.SendAsync(subscriber.Email, subject, body, ct);
                await LogAsync(subscriber.Id, alert, "EMAIL", subject, body, sent, null, ct);
                if (sent) dispatched++;
            }

            // Push
            if (subscription.NotifyByPush && subscriber.PushToken is not null)
            {
                string title = $"{incomingLevel.ToEmoji()} {alert.SuburbName} — {alert.AlertLevel} Alert";
                string body  = BuildPushBody(alert);
                bool sent = await _push.SendAsync(subscriber.PushToken, title, body, ct);
                await LogAsync(subscriber.Id, alert, "PUSH", title, body, sent, null, ct);
                if (sent) dispatched++;
            }
        }

        _logger.LogInformation(
            "Alert processed: suburb={SuburbId} level={Level} dispatched={Count}",
            alert.SuburbId, alert.AlertLevel, dispatched);

        return dispatched;
    }

    // ── Email content builder ─────────────────────────────────────────────────

    private static (string subject, string html) BuildEmailContent(
        SuburbAlertWebhookRequest alert,
        AlertLevel level)
    {
        string emoji      = level.ToEmoji();
        string levelColor = level switch
        {
            AlertLevel.Red    => "#ef4444",
            AlertLevel.Orange => "#f97316",
            AlertLevel.Yellow => "#eab308",
            _                 => "#22c55e",
        };

        string subject = $"{emoji} Community Alert: {alert.SuburbName} has reached {alert.AlertLevel} status";

        string html = $"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="margin:0;padding:0;background:#0a0c10;font-family:sans-serif">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:40px 20px">
                    <table width="560" cellpadding="0" cellspacing="0"
                           style="background:#111318;border-radius:12px;border:1px solid #252832;overflow:hidden">

                      <!-- Header -->
                      <tr>
                        <td style="background:{levelColor}22;border-bottom:2px solid {levelColor};
                                   padding:24px 32px">
                          <div style="font-size:32px;margin-bottom:8px">{emoji}</div>
                          <div style="color:{levelColor};font-size:12px;font-weight:700;
                                      letter-spacing:2px;text-transform:uppercase;
                                      font-family:monospace">
                            {alert.AlertLevel} ALERT
                          </div>
                          <div style="color:#e8eaf0;font-size:22px;font-weight:700;margin-top:4px">
                            {alert.SuburbName}
                          </div>
                        </td>
                      </tr>

                      <!-- Body -->
                      <tr>
                        <td style="padding:24px 32px">
                          <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 20px">
                            The Community Alerts heat score for
                            <strong style="color:#e8eaf0">{alert.SuburbName}</strong>
                            has reached <strong style="color:{levelColor}">{alert.AlertLevel}</strong>
                            (score: {alert.HeatScore}).
                            There are currently <strong style="color:#e8eaf0">{alert.IncidentCount} active incidents</strong>
                            in this area.
                          </p>

                          <table width="100%" cellpadding="0" cellspacing="0"
                                 style="background:#191c24;border-radius:8px;border:1px solid #252832">
                            <tr>
                              <td style="padding:12px 16px;border-bottom:1px solid #252832">
                                <span style="color:#6b7280;font-size:11px;font-family:monospace">HEAT SCORE</span><br>
                                <span style="color:{levelColor};font-size:24px;font-weight:700">{alert.HeatScore}</span>
                              </td>
                              <td style="padding:12px 16px;border-bottom:1px solid #252832">
                                <span style="color:#6b7280;font-size:11px;font-family:monospace">PREVIOUS LEVEL</span><br>
                                <span style="color:#e8eaf0;font-size:16px;font-weight:600">{alert.PreviousAlertLevel}</span>
                              </td>
                              <td style="padding:12px 16px;border-bottom:1px solid #252832">
                                <span style="color:#6b7280;font-size:11px;font-family:monospace">ACTIVE INCIDENTS</span><br>
                                <span style="color:#e8eaf0;font-size:16px;font-weight:600">{alert.IncidentCount}</span>
                              </td>
                            </tr>
                          </table>

                          <div style="margin-top:24px">
                            <a href="https://communityalerts.co.za/map?suburb={alert.SuburbId}"
                               style="display:inline-block;background:{levelColor};color:#fff;
                                      text-decoration:none;padding:12px 24px;border-radius:8px;
                                      font-weight:700;font-size:14px">
                              View on Map →
                            </a>
                          </div>
                        </td>
                      </tr>

                      <!-- Footer -->
                      <tr>
                        <td style="padding:16px 32px;border-top:1px solid #252832">
                          <p style="color:#4b5563;font-size:11px;font-family:monospace;margin:0">
                            Community Alerts · Cape Town ·
                            <a href="https://communityalerts.co.za/unsubscribe"
                               style="color:#6b7280">Unsubscribe</a>
                          </p>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """;

        return (subject, html);
    }

    private static string BuildPushBody(SuburbAlertWebhookRequest alert) =>
        $"Heat score: {alert.HeatScore} · {alert.IncidentCount} active incidents. Tap to view the map.";

    // ── Logging ───────────────────────────────────────────────────────────────

    private async Task LogAsync(
        int subscriberId,
        SuburbAlertWebhookRequest alert,
        string channel,
        string subject,
        string body,
        bool sent,
        string? error,
        CancellationToken ct)
    {
        _db.Logs.Add(new NotificationLog
        {
            SubscriberId = subscriberId,
            SuburbId     = alert.SuburbId,
            Channel      = channel,
            AlertLevel   = alert.AlertLevel,
            Subject      = subject,
            Body         = body[..Math.Min(body.Length, 4000)],
            Sent         = sent,
            ErrorMessage = error,
        });
        await _db.SaveChangesAsync(ct);
    }
}
