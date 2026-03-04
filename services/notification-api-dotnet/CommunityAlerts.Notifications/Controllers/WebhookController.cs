using CommunityAlerts.Notifications.DTOs;
using CommunityAlerts.Notifications.Services;
using Microsoft.AspNetCore.Mvc;

namespace CommunityAlerts.Notifications.Controllers;

/// <summary>
/// Receives inbound alert events from the Spring Boot backend.
/// This is the primary integration point — Spring Boot calls this endpoint
/// immediately after HeatScoreService recalculates a suburb.
/// </summary>
[ApiController]
[Route("api/v1/notifications")]
[Produces("application/json")]
public class WebhookController : ControllerBase
{
    private readonly INotificationService _notifications;
    private readonly ILogger<WebhookController> _logger;

    public WebhookController(
        INotificationService notifications,
        ILogger<WebhookController> logger)
    {
        _notifications = notifications;
        _logger        = logger;
    }

    /// <summary>
    /// Called by the Spring Boot backend when a suburb's alert level changes.
    /// Triggers notification dispatch to all matching subscribers.
    /// </summary>
    [HttpPost("webhook/suburb-alert")]
    [ProducesResponseType(typeof(WebhookAckResponse), 200)]
    public async Task<IActionResult> SuburbAlert(
        [FromBody] SuburbAlertWebhookRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.SuburbId) ||
            string.IsNullOrWhiteSpace(request.AlertLevel))
            return BadRequest(new { error = "SuburbId and AlertLevel are required." });

        int dispatched = await _notifications.ProcessAlertAsync(request, ct);

        return Ok(new WebhookAckResponse(
            Acknowledged:  true,
            SuburbId:      request.SuburbId,
            AlertLevel:    request.AlertLevel,
            Dispatched:    dispatched,
            ProcessedAt:   DateTime.UtcNow
        ));
    }
}

public record WebhookAckResponse(
    bool Acknowledged, string SuburbId, string AlertLevel,
    int Dispatched, DateTime ProcessedAt);
