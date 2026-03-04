using CommunityAlerts.Notifications.DTOs;
using CommunityAlerts.Notifications.Services;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;

namespace CommunityAlerts.Notifications.Controllers;

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
