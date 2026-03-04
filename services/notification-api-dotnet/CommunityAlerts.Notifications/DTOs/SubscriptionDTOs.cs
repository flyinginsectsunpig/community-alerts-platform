using FluentValidation;

namespace CommunityAlerts.Notifications.DTOs;

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
