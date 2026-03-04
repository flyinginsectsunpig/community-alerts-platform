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
