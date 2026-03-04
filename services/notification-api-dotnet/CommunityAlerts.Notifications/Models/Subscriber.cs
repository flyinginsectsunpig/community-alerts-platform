namespace CommunityAlerts.Notifications.Models;

/// <summary>
/// A user who has opted in to receive alerts for one or more suburbs.
/// In production this would link to the main user store in the Spring Boot service.
/// </summary>
public class Subscriber
{
    public int    Id       { get; set; }
    public string Email    { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;

    /// <summary>Push notification device token (FCM / APNs).</summary>
    public string? PushToken { get; set; }

    public bool IsActive    { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<SuburbSubscription> Subscriptions { get; set; } = new List<SuburbSubscription>();
}
