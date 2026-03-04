namespace CommunityAlerts.Notifications.Models;

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
