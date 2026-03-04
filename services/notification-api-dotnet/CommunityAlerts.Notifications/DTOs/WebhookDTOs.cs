namespace CommunityAlerts.Notifications.DTOs;

/// <summary>
/// Inbound webhook from the Spring Boot backend.
/// Called whenever HeatScoreService recalculates a suburb and the alert level changes.
/// </summary>
public record SuburbAlertWebhookRequest(
    string SuburbId,
    string SuburbName,
    int    HeatScore,
    string AlertLevel,
    string PreviousAlertLevel,
    int    IncidentCount,
    DateTime TriggeredAt
);
