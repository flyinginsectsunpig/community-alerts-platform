using AlertProcessor.Data;
using AlertProcessor.Domain;
using AlertProcessor.Notifications;
using AlertProcessor.Processing;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AlertProcessor.Tests;

public class OngoingDangerHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 25, 12, 0, 0, TimeSpan.Zero);

    private const double AlertLat = 51.5074;
    private const double AlertLng = -0.1278;

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private sealed class FakeDangerWatchRepository(AlertState? state, params DangerWatcher[] watchers)
        : IDangerWatchRepository
    {
        public int WatcherQueries { get; private set; }

        public Task<AlertState?> GetAlertStateAsync(Guid alertId, CancellationToken ct) =>
            Task.FromResult(state);

        public Task<IReadOnlyList<DangerWatcher>> GetDangerWatchersAsync(CancellationToken ct)
        {
            WatcherQueries++;
            return Task.FromResult<IReadOnlyList<DangerWatcher>>(watchers);
        }
    }

    private static AlertScoredEvent Scored() => new(
        Guid.NewGuid(), "CRITICAL", 0.95, "v1", "ASSAULT", AlertLat, AlertLng, Now);

    private static AlertState State(AlertScoredEvent scored, bool ongoing) => new(
        scored.AlertId, "ASSAULT", "ACTIVE", ongoing, Now.AddMinutes(-10));

    // About 3.3 km north of the alert, radius 500 m: outside the 2x escalation
    // radius, and its edge (~2.8 km) is within a 5 km reach.
    private static DangerWatcher Watcher() => new(
        Guid.NewGuid(), 5000,
        [new WatchZone(Guid.NewGuid(), "Home", null, AlertLat + 0.03, AlertLng, 500, [])]);

    private static (OngoingDangerHandler Handler, RecordingPushSender Sender) Build(
        FakeDangerWatchRepository repository)
    {
        var sender = new RecordingPushSender();
        var dispatcher = new NotificationDispatcher(
            new CountingNotificationRepository(),
            new FakePushSubscriptions(new PushSubscriptionRow(1, "https://push/one", "p256dh", "auth")),
            sender, new HttpClient(), TestWorkerOptions.Options(),
            NullLogger<NotificationDispatcher>.Instance);
        var handler = new OngoingDangerHandler(
            repository, dispatcher, new FixedTimeProvider(Now),
            NullLogger<OngoingDangerHandler>.Instance);
        return (handler, sender);
    }

    [Fact]
    public async Task NonQualifyingAlert_neverLoadsWatchers()
    {
        var scored = Scored();
        var repository = new FakeDangerWatchRepository(State(scored, ongoing: false), Watcher());
        var (handler, sender) = Build(repository);

        await handler.HandleAsync(scored, CancellationToken.None);

        Assert.Equal(0, repository.WatcherQueries);
        Assert.Empty(sender.Sent);
    }

    [Fact]
    public async Task MissingAlertRow_doesNothing()
    {
        var repository = new FakeDangerWatchRepository(null, Watcher());
        var (handler, sender) = Build(repository);

        await handler.HandleAsync(Scored(), CancellationToken.None);

        Assert.Equal(0, repository.WatcherQueries);
        Assert.Empty(sender.Sent);
    }

    [Fact]
    public async Task QualifyingAlert_warnsTargets()
    {
        var scored = Scored();
        var repository = new FakeDangerWatchRepository(State(scored, ongoing: true), Watcher());
        var (handler, sender) = Build(repository);

        await handler.HandleAsync(scored, CancellationToken.None);

        Assert.Single(sender.Sent);
    }
}
