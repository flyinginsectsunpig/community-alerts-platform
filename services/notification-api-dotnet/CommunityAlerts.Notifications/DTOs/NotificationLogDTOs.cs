namespace CommunityAlerts.Notifications.DTOs;

public record NotificationLogResponse(
    int    Id,
    int    SubscriberId,
    string SuburbId,
    string Channel,
    string AlertLevel,
    string Subject,
    bool   Sent,
    string? ErrorMessage,
    DateTime SentAt
);

public record HealthResponse(
    string Status,
    string Service,
    DateTime Timestamp,
    Dictionary<string, bool> Checks
);
