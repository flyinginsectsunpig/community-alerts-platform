namespace CommunityAlerts.Notifications.Services;

/// <summary>
/// Push notification service.
///
/// This stub logs push notifications to the console.
/// In production, replace with Firebase Cloud Messaging (FCM):
///
///   POST https://fcm.googleapis.com/v1/projects/{projectId}/messages:send
///   Authorization: Bearer {access_token}
///
/// The structure is kept intentionally simple so that swapping the
/// implementation is a single-class change without touching any caller.
/// </summary>
public class PushService : IPushService
{
    private readonly ILogger<PushService> _logger;
    private readonly IHttpClientFactory   _http;

    public PushService(ILogger<PushService> logger, IHttpClientFactory http)
    {
        _logger = logger;
        _http   = http;
    }

    public async Task<bool> SendAsync(
        string deviceToken,
        string title,
        string body,
        CancellationToken ct = default)
    {
        // Development stub — logs the notification payload
        _logger.LogInformation(
            "[PUSH SIMULATION] Token={Token} | Title={Title} | Body={Body}",
            deviceToken[..Math.Min(12, deviceToken.Length)] + "…",
            title,
            body);

        // TODO: Replace with real FCM call:
        // var client  = _http.CreateClient("FCM");
        // var payload = new { message = new { token = deviceToken,
        //                                     notification = new { title, body } } };
        // var res = await client.PostAsJsonAsync("messages:send", payload, ct);
        // return res.IsSuccessStatusCode;

        await Task.CompletedTask;
        return true;
    }
}
