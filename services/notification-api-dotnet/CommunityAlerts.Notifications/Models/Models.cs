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

/// <summary>
/// Persisted log of every notification that was dispatched.
/// Enables audit trails, retry logic, and deduplication.
/// </summary>
public class NotificationLog
{
    public int    Id           { get; set; }
    public int    SubscriberId { get; set; }
    public string SuburbId     { get; set; } = string.Empty;
    public string Channel      { get; set; } = string.Empty;  // EMAIL | PUSH
    public string AlertLevel   { get; set; } = string.Empty;
    public string Subject      { get; set; } = string.Empty;
    public string Body         { get; set; } = string.Empty;
    public bool   Sent         { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime SentAt     { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Inbound webhook payload from the Spring Boot backend.
/// Fired when a suburb's heat score crosses an alert threshold.
/// </summary>
public class SuburbAlertEvent
{
    public string SuburbId    { get; set; } = string.Empty;
    public string SuburbName  { get; set; } = string.Empty;
    public int    HeatScore   { get; set; }
    public string AlertLevel  { get; set; } = string.Empty;
    public string PreviousAlertLevel { get; set; } = string.Empty;
    public int    IncidentCount { get; set; }
    public DateTime TriggeredAt { get; set; } = DateTime.UtcNow;
}

public enum AlertLevel
{
    Green  = 0,
    Yellow = 1,
    Orange = 2,
    Red    = 3
}

public static class AlertLevelExtensions
{
    public static AlertLevel Parse(string level) => level.ToUpperInvariant() switch
    {
        "GREEN"  => AlertLevel.Green,
        "YELLOW" => AlertLevel.Yellow,
        "ORANGE" => AlertLevel.Orange,
        "RED"    => AlertLevel.Red,
        _        => AlertLevel.Orange
    };

    public static string ToEmoji(this AlertLevel level) => level switch
    {
        AlertLevel.Green  => "🟢",
        AlertLevel.Yellow => "🟡",
        AlertLevel.Orange => "🟠",
        AlertLevel.Red    => "🔴",
        _                 => "⚪"
    };
}
