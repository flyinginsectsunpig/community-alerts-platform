using CommunityAlerts.Notifications.Data;
using CommunityAlerts.Notifications.DTOs;
using CommunityAlerts.Notifications.Models;
using Microsoft.EntityFrameworkCore;

namespace CommunityAlerts.Notifications.Services;

public class SubscriberService : ISubscriberService
{
    private readonly NotificationDbContext _db;

    public SubscriberService(NotificationDbContext db) => _db = db;

    public async Task<SubscriberResponse> CreateAsync(
        CreateSubscriberRequest request,
        CancellationToken ct = default)
    {
        if (await _db.Subscribers.AnyAsync(s => s.Email == request.Email, ct))
            throw new InvalidOperationException($"Email already registered: {request.Email}");

        var subscriber = new Subscriber
        {
            Email     = request.Email,
            Username  = request.Username,
            PushToken = request.PushToken,
        };

        _db.Subscribers.Add(subscriber);
        await _db.SaveChangesAsync(ct);
        return ToResponse(subscriber);
    }

    public async Task<SubscriberResponse?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var subscriber = await _db.Subscribers
            .Include(s => s.Subscriptions)
            .FirstOrDefaultAsync(s => s.Id == id, ct);

        return subscriber is null ? null : ToResponse(subscriber);
    }

    public async Task<IEnumerable<SubscriberResponse>> GetAllAsync(CancellationToken ct = default)
    {
        var list = await _db.Subscribers
            .Include(s => s.Subscriptions)
            .OrderBy(s => s.Username)
            .ToListAsync(ct);

        return list.Select(ToResponse);
    }

    public async Task<SubscriptionResponse> AddSubscriptionAsync(
        int subscriberId,
        CreateSubscriptionRequest request,
        CancellationToken ct = default)
    {
        var subscriber = await _db.Subscribers.FindAsync([subscriberId], ct)
            ?? throw new KeyNotFoundException($"Subscriber not found: {subscriberId}");

        bool exists = await _db.Subscriptions
            .AnyAsync(s => s.SubscriberId == subscriberId && s.SuburbId == request.SuburbId, ct);

        if (exists)
            throw new InvalidOperationException(
                $"Already subscribed to suburb: {request.SuburbId}");

        var subscription = new SuburbSubscription
        {
            SubscriberId      = subscriberId,
            SuburbId          = request.SuburbId,
            SuburbName        = request.SuburbName,
            MinimumAlertLevel = AlertLevelExtensions.Parse(request.MinimumAlertLevel),
            NotifyByEmail     = request.NotifyByEmail,
            NotifyByPush      = request.NotifyByPush,
        };

        _db.Subscriptions.Add(subscription);
        await _db.SaveChangesAsync(ct);
        return ToSubscriptionResponse(subscription);
    }

    public async Task RemoveSubscriptionAsync(
        int subscriberId,
        int subscriptionId,
        CancellationToken ct = default)
    {
        var sub = await _db.Subscriptions
            .FirstOrDefaultAsync(s => s.Id == subscriptionId && s.SubscriberId == subscriberId, ct)
            ?? throw new KeyNotFoundException($"Subscription not found: {subscriptionId}");

        _db.Subscriptions.Remove(sub);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IEnumerable<NotificationLogResponse>> GetLogsAsync(
        int subscriberId,
        CancellationToken ct = default)
    {
        if (!await _db.Subscribers.AnyAsync(s => s.Id == subscriberId, ct))
            throw new KeyNotFoundException($"Subscriber not found: {subscriberId}");

        var logs = await _db.Logs
            .Where(l => l.SubscriberId == subscriberId)
            .OrderByDescending(l => l.SentAt)
            .Take(50)
            .ToListAsync(ct);

        return logs.Select(l => new NotificationLogResponse(
            l.Id, l.SubscriberId, l.SuburbId, l.Channel,
            l.AlertLevel, l.Subject, l.Sent, l.ErrorMessage, l.SentAt));
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private static SubscriberResponse ToResponse(Subscriber s) => new(
        s.Id, s.Email, s.Username, s.IsActive, s.CreatedAt,
        s.Subscriptions.Select(ToSubscriptionResponse));

    private static SubscriptionResponse ToSubscriptionResponse(SuburbSubscription s) => new(
        s.Id, s.SuburbId, s.SuburbName,
        s.MinimumAlertLevel.ToString().ToUpperInvariant(),
        s.NotifyByEmail, s.NotifyByPush, s.CreatedAt);
}
