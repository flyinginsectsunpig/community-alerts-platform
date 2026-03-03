using FluentValidation;

namespace CommunityAlerts.Notifications.DTOs;

// ── Subscriber DTOs ───────────────────────────────────────────────────────────

public record CreateSubscriberRequest(
    string Email,
    string Username,
    string? PushToken
);

public record SubscriberResponse(
    int    Id,
    string Email,
    string Username,
    bool   IsActive,
    DateTime CreatedAt,
    IEnumerable<SubscriptionResponse> Subscriptions
);

// ── Subscription DTOs ─────────────────────────────────────────────────────────

public record CreateSubscriptionRequest(
    string SuburbId,
    string SuburbName,
    string MinimumAlertLevel,   // "GREEN" | "YELLOW" | "ORANGE" | "RED"
    bool   NotifyByEmail,
    bool   NotifyByPush
);

public record SubscriptionResponse(
    int    Id,
    string SuburbId,
    string SuburbName,
    string MinimumAlertLevel,
    bool   NotifyByEmail,
    bool   NotifyByPush,
    DateTime CreatedAt
);

// ── Webhook DTOs ──────────────────────────────────────────────────────────────

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

// ── Notification log ──────────────────────────────────────────────────────────

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

// ── Health ────────────────────────────────────────────────────────────────────

public record HealthResponse(
    string Status,
    string Service,
    DateTime Timestamp,
    Dictionary<string, bool> Checks
);

// ── Validators ────────────────────────────────────────────────────────────────

public class CreateSubscriberValidator : AbstractValidator<CreateSubscriberRequest>
{
    public CreateSubscriberValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("Invalid email address.");

        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("Username is required.")
            .Length(2, 50).WithMessage("Username must be between 2 and 50 characters.");
    }
}

public class CreateSubscriptionValidator : AbstractValidator<CreateSubscriptionRequest>
{
    private static readonly string[] ValidLevels = ["GREEN", "YELLOW", "ORANGE", "RED"];

    public CreateSubscriptionValidator()
    {
        RuleFor(x => x.SuburbId)
            .NotEmpty().WithMessage("SuburbId is required.");

        RuleFor(x => x.SuburbName)
            .NotEmpty().WithMessage("SuburbName is required.");

        RuleFor(x => x.MinimumAlertLevel)
            .Must(l => ValidLevels.Contains(l.ToUpperInvariant()))
            .WithMessage("MinimumAlertLevel must be GREEN, YELLOW, ORANGE, or RED.");
    }
}
