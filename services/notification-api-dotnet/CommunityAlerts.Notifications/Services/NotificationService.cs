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
                var (subject, body) = EmailTemplateBuilder.BuildEmailContent(alert, incomingLevel);
                bool sent = await _email.SendAsync(subscriber.Email, subject, body, ct);
                await LogAsync(subscriber.Id, alert, "EMAIL", subject, body, sent, null, ct);
                if (sent) dispatched++;
            }

            // Push
            if (subscription.NotifyByPush && subscriber.PushToken is not null)
            {
                string title = $"{incomingLevel.ToEmoji()} {alert.SuburbName} — {alert.AlertLevel} Alert";
                string body  = EmailTemplateBuilder.BuildPushBody(alert);
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
