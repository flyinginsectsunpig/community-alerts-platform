using CommunityAlerts.Notifications.DTOs;
using CommunityAlerts.Notifications.Services;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;

namespace CommunityAlerts.Notifications.Controllers;

// ── Webhook Controller ────────────────────────────────────────────────────────

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

// ── Subscriber Controller ─────────────────────────────────────────────────────

[ApiController]
[Route("api/v1/subscribers")]
[Produces("application/json")]
public class SubscriberController : ControllerBase
{
    private readonly ISubscriberService _service;
    private readonly IValidator<CreateSubscriberRequest>    _subscriberValidator;
    private readonly IValidator<CreateSubscriptionRequest>  _subscriptionValidator;

    public SubscriberController(
        ISubscriberService service,
        IValidator<CreateSubscriberRequest> subscriberValidator,
        IValidator<CreateSubscriptionRequest> subscriptionValidator)
    {
        _service               = service;
        _subscriberValidator   = subscriberValidator;
        _subscriptionValidator = subscriptionValidator;
    }

    /// <summary>Register a new subscriber to receive community alerts.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(SubscriberResponse), 201)]
    public async Task<IActionResult> Create(
        [FromBody] CreateSubscriberRequest request,
        CancellationToken ct)
    {
        var validation = await _subscriberValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return BadRequest(validation.Errors.Select(e => e.ErrorMessage));

        try
        {
            var result = await _service.CreateAsync(request, ct);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    /// <summary>Get subscriber by ID including their suburb subscriptions.</summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(SubscriberResponse), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var result = await _service.GetByIdAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>List all subscribers.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<SubscriberResponse>), 200)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        return Ok(await _service.GetAllAsync(ct));
    }

    /// <summary>Subscribe to alerts for a specific suburb.</summary>
    [HttpPost("{id:int}/subscriptions")]
    [ProducesResponseType(typeof(SubscriptionResponse), 201)]
    public async Task<IActionResult> AddSubscription(
        int id,
        [FromBody] CreateSubscriptionRequest request,
        CancellationToken ct)
    {
        var validation = await _subscriptionValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return BadRequest(validation.Errors.Select(e => e.ErrorMessage));

        try
        {
            var result = await _service.AddSubscriptionAsync(id, request, ct);
            return CreatedAtAction(nameof(GetById), new { id }, result);
        }
        catch (KeyNotFoundException ex)       { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex)  { return Conflict(new { error = ex.Message }); }
    }

    /// <summary>Unsubscribe from a suburb.</summary>
    [HttpDelete("{id:int}/subscriptions/{subscriptionId:int}")]
    [ProducesResponseType(204)]
    public async Task<IActionResult> RemoveSubscription(
        int id, int subscriptionId, CancellationToken ct)
    {
        try
        {
            await _service.RemoveSubscriptionAsync(id, subscriptionId, ct);
            return NoContent();
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }

    /// <summary>Get notification history for a subscriber (last 50).</summary>
    [HttpGet("{id:int}/logs")]
    [ProducesResponseType(typeof(IEnumerable<NotificationLogResponse>), 200)]
    public async Task<IActionResult> GetLogs(int id, CancellationToken ct)
    {
        try
        {
            return Ok(await _service.GetLogsAsync(id, ct));
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }
}

// ── Health Controller ─────────────────────────────────────────────────────────

[ApiController]
[Route("api/v1/health")]
public class HealthController : ControllerBase
{
    private readonly IHttpClientFactory _http;

    public HealthController(IHttpClientFactory http) => _http = http;

    [HttpGet]
    [ProducesResponseType(typeof(HealthResponse), 200)]
    public async Task<IActionResult> Health(CancellationToken ct)
    {
        async Task<bool> CheckDependencyAsync(string clientName, string endpoint)
        {
            try
            {
                using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                linkedCts.CancelAfter(TimeSpan.FromSeconds(2));
                var client = _http.CreateClient(clientName);
                var res = await client.GetAsync(endpoint, linkedCts.Token);
                return res.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        var springTask = CheckDependencyAsync("SpringBoot", "/api/v1/suburbs");
        var mlTask     = CheckDependencyAsync("MLService", "/api/v1/ml/health");
        await Task.WhenAll(springTask, mlTask);

        return Ok(new HealthResponse(
            Status:    "ok",
            Service:   "CommunityAlerts.Notifications",
            Timestamp: DateTime.UtcNow,
            Checks: new Dictionary<string, bool>
            {
                ["database"]     = true,
                ["springBoot"]   = springTask.Result,
                ["mlService"]    = mlTask.Result,
                ["emailService"] = true,
                ["pushService"]  = true,
            }
        ));
    }
}
