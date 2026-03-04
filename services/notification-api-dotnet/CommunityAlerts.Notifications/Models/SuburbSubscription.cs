namespace CommunityAlerts.Notifications.Models;

/// <summary>
/// Links a subscriber to a specific suburb with per-suburb notification preferences.
/// </summary>
public class SuburbSubscription
{
    public int    Id        { get; set; }
    public int    SubscriberId { get; set; }
    public string SuburbId  { get; set; } = string.Empty;
    public string SuburbName { get; set; } = string.Empty;

    /// <summary>Minimum alert level to trigger a notification for this suburb.</summary>
    public AlertLevel MinimumAlertLevel { get; set; } = AlertLevel.Orange;

    public bool NotifyByEmail { get; set; } = true;
    public bool NotifyByPush  { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Subscriber Subscriber { get; set; } = null!;
}
