using AlertProcessor.Data;
using AlertProcessor.Domain;
using AlertProcessor.Notifications;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AlertProcessor.Tests;

public class NotificationDispatcherTests
{
    private static NotificationDispatcher Dispatcher(
        CountingNotificationRepository repository,
        FakePushSubscriptions subscriptions,
        RecordingPushSender sender,
        HttpClient? httpClient = null,
        WorkerOptions? options = null) => new(
        repository, subscriptions, sender, httpClient ?? new HttpClient(),
        options ?? TestWorkerOptions.Options(),
        NullLogger<NotificationDispatcher>.Instance);

    private static AlertCreatedEvent Created() => new(
        Guid.NewGuid(), "THEFT", "Bike stolen from front garden",
        51.5074, -0.1278, DateTimeOffset.UtcNow);

    private static ZoneMatch Match() => new(
        new WatchZone(Guid.NewGuid(), "Home", null, 51.5074, -0.1278, 1000, []),
        250.0);

    private static PushSubscriptionRow Subscription(string endpoint) =>
        new(1, endpoint, "p256dh", "auth");

    private static readonly DateTimeOffset Now = new(2026, 10, 25, 12, 0, 0, TimeSpan.Zero);

    private static AlertScoredEvent Scored(string category) => new(
        Guid.NewGuid(), "HIGH", 0.9, "v1", category, 51.5074, -0.1278, Now);

    private static DangerTarget Danger() => new(
        new WatchZone(Guid.NewGuid(), "Home", null, 51.5074, -0.1278, 1000, []),
        1800.0);

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
    public async Task RedeliveredMatchDoesNotPushAgain()
    {
        var repository = new CountingNotificationRepository(insertResult: 0);
        var subscriptions = new FakePushSubscriptions(Subscription("https://push/one"));
        var sender = new RecordingPushSender();

        await Dispatcher(repository, subscriptions, sender)
            .DispatchZoneMatchesAsync(Created(), [Match()], CancellationToken.None);

        Assert.Empty(sender.Sent);
    }

    [Fact]
    public async Task DangerWarning_pushesOncePerTargetWithCopy()
    {
        var repository = new CountingNotificationRepository();
        var subscriptions = new FakePushSubscriptions(Subscription("https://push/one"));
        var sender = new RecordingPushSender();

        await Dispatcher(repository, subscriptions, sender).DispatchDangerWarningsAsync(
            Scored("ASSAULT"), Now.AddMinutes(-6), [Danger()], Now, CancellationToken.None);

        Assert.Equal(1, repository.Inserted);
        var sent = Assert.Single(sender.Sent);
        Assert.Equal("Avoid area: ongoing incident 1.8 km from 'Home'", sent.Title);
        Assert.Equal("Assault reported 6 min ago, still in progress. Consider another route.", sent.Body);
    }

    [Fact]
    public async Task DangerWarning_redeliveryDoesNotPushAgain()
    {
        var repository = new CountingNotificationRepository(insertResult: 0);
        var subscriptions = new FakePushSubscriptions(Subscription("https://push/one"));
        var sender = new RecordingPushSender();

        await Dispatcher(repository, subscriptions, sender).DispatchDangerWarningsAsync(
            Scored("ASSAULT"), Now.AddMinutes(-6), [Danger()], Now, CancellationToken.None);

        Assert.Empty(sender.Sent);
    }

    [Fact]
    public async Task DangerWarning_neverPostsWebhook()
    {
        var handler = new CountingHandler();
        var options = TestWorkerOptions.Options("https://hooks.example/slack");
        var subscriptions = new FakePushSubscriptions(Subscription("https://push/one"));

        await Dispatcher(
                new CountingNotificationRepository(), subscriptions, new RecordingPushSender(),
                new HttpClient(handler), options)
            .DispatchDangerWarningsAsync(
                Scored("ASSAULT"), Now.AddMinutes(-6), [Danger()], Now, CancellationToken.None);

        Assert.Equal(0, handler.Calls);
    }

    [Fact]
    public async Task DangerWarning_labelsOtherAsIncident()
    {
        var subscriptions = new FakePushSubscriptions(Subscription("https://push/one"));
        var sender = new RecordingPushSender();

        await Dispatcher(new CountingNotificationRepository(), subscriptions, sender)
            .DispatchDangerWarningsAsync(
                Scored("OTHER"), Now.AddMinutes(-6), [Danger()], Now, CancellationToken.None);

        Assert.StartsWith("Incident reported", Assert.Single(sender.Sent).Body);
    }

    private sealed class CountingHandler : HttpMessageHandler
    {
        public int Calls { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls++;
            return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK));
        }
    }
}
