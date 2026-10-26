using AlertProcessor.Data;
using AlertProcessor.Domain;
using AlertProcessor.Notifications;

namespace AlertProcessor.Tests;

internal sealed class CountingNotificationRepository(int insertResult = 1) : INotificationRepository
{
    public int Inserted { get; private set; }
    public List<string> Messages { get; } = [];

    public Task<int> InsertAsync(
        Guid watchZoneId, Guid alertId, string kind, string message, CancellationToken ct)
    {
        Inserted += insertResult;
        Messages.Add(message);
        return Task.FromResult(insertResult);
    }
}

internal sealed class FakePushSubscriptions(params PushSubscriptionRow[] rows) : IPushSubscriptionRepository
{
    public List<string> Deleted { get; } = [];
    public int Queries { get; private set; }

    public Task<IReadOnlyList<PushSubscriptionRow>> GetForZoneAsync(Guid zoneId, CancellationToken ct)
    {
        Queries++;
        return Task.FromResult<IReadOnlyList<PushSubscriptionRow>>(rows);
    }

    public Task DeleteAsync(string endpoint, CancellationToken ct)
    {
        Deleted.Add(endpoint);
        return Task.CompletedTask;
    }
}

internal sealed class RecordingPushSender(PushSendResult result = PushSendResult.Sent, bool enabled = true)
    : IPushSender
{
    public List<(string Endpoint, string Title, string Body)> Sent { get; } = [];

    public bool Enabled => enabled;

    public Task<PushSendResult> SendAsync(
        PushSubscriptionRow subscription, string title, string body, Guid alertId, CancellationToken ct)
    {
        Sent.Add((subscription.Endpoint, title, body));
        return Task.FromResult(result);
    }
}

internal static class TestWorkerOptions
{
    /// <summary>Inert options; the webhook stays disabled unless a URL is given.</summary>
    internal static WorkerOptions Options(string? notificationWebhookUrl = null) => new()
    {
        PostgresConnectionString = "unused",
        RedisConfiguration = "unused",
        RabbitHost = "unused",
        RabbitPort = 0,
        RabbitUser = "unused",
        RabbitPassword = "unused",
        RabbitVhost = "unused",
        RabbitSsl = false,
        NotificationWebhookUrl = notificationWebhookUrl,
    };
}
