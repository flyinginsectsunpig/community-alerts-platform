using System.Text.Json;
using AlertProcessor.Domain;
using Microsoft.Extensions.Logging;
using WebPush;

namespace AlertProcessor.Notifications;

public enum PushSendResult
{
    Sent,
    /// <summary>The push service says the subscription no longer exists (404/410).</summary>
    Gone,
    Failed,
}

public interface IPushSender
{
    /// <summary>False when VAPID keys are not configured; sends are skipped.</summary>
    bool Enabled { get; }

    Task<PushSendResult> SendAsync(
        PushSubscriptionRow subscription, string title, string body, Guid alertId, CancellationToken ct);
}

/// <summary>
/// Web Push (VAPID) delivery. The payload shape ({title, body, alertId}) is
/// consumed by the web app's service worker (apps/web/public/sw.js).
/// </summary>
public sealed class WebPushSender(WorkerOptions options, ILogger<WebPushSender> logger) : IPushSender
{
    private readonly WebPushClient client = new();

    private readonly VapidDetails? vapid =
        !string.IsNullOrEmpty(options.VapidSubject)
        && !string.IsNullOrEmpty(options.VapidPublicKey)
        && !string.IsNullOrEmpty(options.VapidPrivateKey)
            ? new VapidDetails(options.VapidSubject, options.VapidPublicKey, options.VapidPrivateKey)
            : null;

    public bool Enabled => vapid != null;

    public async Task<PushSendResult> SendAsync(
        PushSubscriptionRow subscription, string title, string body, Guid alertId, CancellationToken ct)
    {
        if (vapid == null)
        {
            return PushSendResult.Failed;
        }

        var target = new PushSubscription(subscription.Endpoint, subscription.P256dh, subscription.Auth);
        var payload = JsonSerializer.Serialize(new { title, body, alertId }, JsonDefaults.Options);
        try
        {
            await client.SendNotificationAsync(target, payload, vapid, ct);
            return PushSendResult.Sent;
        }
        catch (WebPushException ex) when (
            ex.StatusCode is System.Net.HttpStatusCode.Gone or System.Net.HttpStatusCode.NotFound)
        {
            return PushSendResult.Gone;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Push delivery failed for subscription {SubscriptionId}", subscription.Id);
            return PushSendResult.Failed;
        }
    }
}
