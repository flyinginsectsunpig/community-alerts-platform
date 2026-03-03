using CommunityAlerts.Notifications.DTOs;

namespace CommunityAlerts.Notifications.Services;

public interface INotificationService
{
    /// <summary>
    /// Processes an inbound suburb alert event from the Spring Boot backend.
    /// Finds all matching subscribers and dispatches notifications on the appropriate channels.
    /// </summary>
    Task<int> ProcessAlertAsync(SuburbAlertWebhookRequest alert, CancellationToken ct = default);
}

public interface IEmailService
{
    Task<bool> SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default);
}

public interface IPushService
{
    Task<bool> SendAsync(string deviceToken, string title, string body, CancellationToken ct = default);
}

public interface ISubscriberService
{
    Task<SubscriberResponse>              CreateAsync(CreateSubscriberRequest request, CancellationToken ct = default);
    Task<SubscriberResponse?>             GetByIdAsync(int id, CancellationToken ct = default);
    Task<IEnumerable<SubscriberResponse>> GetAllAsync(CancellationToken ct = default);
    Task<SubscriptionResponse>            AddSubscriptionAsync(int subscriberId, CreateSubscriptionRequest request, CancellationToken ct = default);
    Task                                  RemoveSubscriptionAsync(int subscriberId, int subscriptionId, CancellationToken ct = default);
    Task<IEnumerable<NotificationLogResponse>> GetLogsAsync(int subscriberId, CancellationToken ct = default);
}
