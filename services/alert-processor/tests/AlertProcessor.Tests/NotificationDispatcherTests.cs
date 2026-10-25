using System.Globalization;
using AlertProcessor.Data;
using AlertProcessor.Domain;
using AlertProcessor.Notifications;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AlertProcessor.Tests;

public class NotificationDispatcherTests
{
    private sealed class CountingNotificationRepository(int insertResult = 1) : INotificationRepository
    {
        public int Inserted { get; private set; }
        public List<string> Messages { get; } = [];

        public Task<int> InsertAsync(
            Guid watchZoneId, Guid alertId, string kind, string message, CancellationToken ct)
        {
            Inserted += insertResult;
            Messages.Add(message);
            return Task.FromResult(insertResult);
        }
    }

    private sealed class FakePushSubscriptions(params PushSubscriptionRow[] rows) : IPushSubscriptionRepository
    {
        public List<string> Deleted { get; } = [];
        public int Queries { get; private set; }

        public Task<IReadOnlyList<PushSubscriptionRow>> GetForZoneAsync(Guid zoneId, CancellationToken ct)
        {
            Queries++;
            return Task.FromResult<IReadOnlyList<PushSubscriptionRow>>(rows);
        }

        public Task DeleteAsync(string endpoint, CancellationToken ct)
        {
            Deleted.Add(endpoint);
            return Task.CompletedTask;
        }
    }

    private sealed class RecordingPushSender(PushSendResult result = PushSendResult.Sent, bool enabled = true)
        : IPushSender
    {
        public List<(string Endpoint, string Title)> Sent { get; } = [];

        public bool Enabled => enabled;

        public Task<PushSendResult> SendAsync(
            PushSubscriptionRow subscription, string title, string body, Guid alertId, CancellationToken ct)
        {
            Sent.Add((subscription.Endpoint, title));
            return Task.FromResult(result);
        }
    }

    private static WorkerOptions Options() => new()
    {
        PostgresConnectionString = "unused",
        RedisConfiguration = "unused",
        RabbitHost = "unused",
        RabbitPort = 0,
        RabbitUser = "unused",
        RabbitPassword = "unused",
        RabbitVhost = "unused",
        RabbitSsl = false,
        // NotificationWebhookUrl stays null so the webhook path is inert.
    };

    private static NotificationDispatcher Dispatcher(
        CountingNotificationRepository repository,
        FakePushSubscriptions subscriptions,
        RecordingPushSender sender) => new(
        repository, subscriptions, sender, new HttpClient(), Options(),
        NullLogger<NotificationDispatcher>.Instance);

    private static AlertCreatedEvent Created() => new(
        Guid.NewGuid(), "THEFT", "Bike stolen from front garden",
        51.5074, -0.1278, DateTimeOffset.UtcNow);

    private static ZoneMatch Match() => new(
        new WatchZone(Guid.NewGuid(), "Home", null, 51.5074, -0.1278, 1000, []),
        250.0);

    private static ZoneMatch DrawnMatch() => new(
        new WatchZone(
            Guid.NewGuid(), "Home", null, 51.5074, -0.1278, 1000, [],
            [new GeoPoint(51.50, -0.13), new GeoPoint(51.51, -0.12), new GeoPoint(51.50, -0.11)]),
        250.0);

    private static AlertScoredEvent Scored() => new(
        Guid.NewGuid(), "HIGH", 0.87, "v1", "THEFT", 51.5074, -0.1278, DateTimeOffset.UtcNow);

    private static PushSubscriptionRow Subscription(string endpoint) =>
        new(1, endpoint, "p256dh", "auth");

    [Fact]
    public async Task FreshZoneMatchPushesToEverySubscription()
    {
        var repository = new CountingNotificationRepository();
        var subscriptions = new FakePushSubscriptions(
            Subscription("https://push/one"), Subscription("https://push/two"));
        var sender = new RecordingPushSender();

        await Dispatcher(repository, subscriptions, sender)
            .DispatchZoneMatchesAsync(Created(), [Match()], CancellationToken.None);

        Assert.Equal(1, repository.Inserted);
        Assert.Equal(2, sender.Sent.Count);
        Assert.All(sender.Sent, s => Assert.Equal("Alert near 'Home'", s.Title));
        Assert.Empty(subscriptions.Deleted);
    }

    [Fact]
    public async Task GoneSubscriptionsAreDeleted()
    {
        var repository = new CountingNotificationRepository();
        var subscriptions = new FakePushSubscriptions(Subscription("https://push/stale"));
        var sender = new RecordingPushSender(PushSendResult.Gone);

        await Dispatcher(repository, subscriptions, sender)
            .DispatchZoneMatchesAsync(Created(), [Match()], CancellationToken.None);

        Assert.Equal(["https://push/stale"], subscriptions.Deleted);
    }

    [Fact]
    public async Task DisabledPushSkipsSubscriptionLookup()
    {
        var repository = new CountingNotificationRepository();
        var subscriptions = new FakePushSubscriptions(Subscription("https://push/one"));
        var sender = new RecordingPushSender(enabled: false);

        await Dispatcher(repository, subscriptions, sender)
            .DispatchZoneMatchesAsync(Created(), [Match()], CancellationToken.None);

        Assert.Equal(1, repository.Inserted);
        Assert.Equal(0, subscriptions.Queries);
        Assert.Empty(sender.Sent);
    }

    [Fact]
    public async Task CircleZoneMatchKeepsDistanceWording()
    {
        var repository = new CountingNotificationRepository();

        await Dispatcher(repository, new FakePushSubscriptions(), new RecordingPushSender())
            .DispatchZoneMatchesAsync(Created(), [Match()], CancellationToken.None);

        Assert.Equal(
            ["New theft report 250 m from your watch zone 'Home'."],
            repository.Messages);
    }

    [Fact]
    public async Task CircleZoneEscalationKeepsDistanceWording()
    {
        // the message embeds the risk score, so "0.87" needs a decimal point
        var (culture, uiCulture) = (CultureInfo.CurrentCulture, CultureInfo.CurrentUICulture);
        CultureInfo.CurrentCulture = CultureInfo.CurrentUICulture = CultureInfo.InvariantCulture;
        try
        {
            var repository = new CountingNotificationRepository();

            await Dispatcher(repository, new FakePushSubscriptions(), new RecordingPushSender())
                .DispatchEscalationsAsync(Scored(), [Match()], CancellationToken.None);

            Assert.Equal(
                ["HIGH severity theft alert 250 m from your watch zone 'Home' (risk score 0.87)."],
                repository.Messages);
        }
        finally
        {
            (CultureInfo.CurrentCulture, CultureInfo.CurrentUICulture) = (culture, uiCulture);
        }
    }

    [Fact]
    public async Task DrawnZoneMatchSaysInside()
    {
        var repository = new CountingNotificationRepository();

        await Dispatcher(repository, new FakePushSubscriptions(), new RecordingPushSender())
            .DispatchZoneMatchesAsync(Created(), [DrawnMatch()], CancellationToken.None);

        Assert.Equal(
            ["New theft report inside your watch zone 'Home'."],
            repository.Messages);
    }

    [Fact]
    public async Task DrawnZoneEscalationSaysInside()
    {
        // the message embeds the risk score, so "0.87" needs a decimal point
        var (culture, uiCulture) = (CultureInfo.CurrentCulture, CultureInfo.CurrentUICulture);
        CultureInfo.CurrentCulture = CultureInfo.CurrentUICulture = CultureInfo.InvariantCulture;
        try
        {
            var repository = new CountingNotificationRepository();

            await Dispatcher(repository, new FakePushSubscriptions(), new RecordingPushSender())
                .DispatchEscalationsAsync(Scored(), [DrawnMatch()], CancellationToken.None);

            Assert.Equal(
                ["HIGH severity theft alert inside your watch zone 'Home' (risk score 0.87)."],
                repository.Messages);
        }
        finally
        {
            (CultureInfo.CurrentCulture, CultureInfo.CurrentUICulture) = (culture, uiCulture);
        }
    }

    [Fact]
    public async Task RedeliveredMatchDoesNotPushAgain()
    {
        var repository = new CountingNotificationRepository(insertResult: 0);
        var subscriptions = new FakePushSubscriptions(Subscription("https://push/one"));
        var sender = new RecordingPushSender();

        await Dispatcher(repository, subscriptions, sender)
            .DispatchZoneMatchesAsync(Created(), [Match()], CancellationToken.None);

        Assert.Empty(sender.Sent);
    }
}
