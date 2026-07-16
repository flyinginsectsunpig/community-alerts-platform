using AlertProcessor.Data;
using AlertProcessor.Domain;
using AlertProcessor.Notifications;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AlertProcessor.Tests;

public class NotificationDispatcherTests
{
    private sealed class CountingNotificationRepository : INotificationRepository
    {
        public int Inserted { get; private set; }

        public Task<int> InsertAsync(
            Guid watchZoneId, Guid alertId, string kind, string message, CancellationToken ct)
        {
            Inserted++;
            return Task.FromResult(1); // fresh insert every time
        }
    }

    private sealed class RecordingEmailSender : IEmailSender
    {
        public List<string> Recipients { get; } = [];

        public Task SendAsync(string to, string subject, string html, CancellationToken ct)
        {
            Recipients.Add(to);
            return Task.CompletedTask;
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

    private static AlertCreatedEvent Created() => new(
        Guid.NewGuid(), "THEFT", "Bike stolen from front garden",
        51.5074, -0.1278, DateTimeOffset.UtcNow);

    private static ZoneMatch Match(string? email) => new(
        new WatchZone(Guid.NewGuid(), "Home", email, 51.5074, -0.1278, 1000, []),
        250.0);

    [Fact]
    public async Task ZoneWithEmailIsEmailed()
    {
        var repository = new CountingNotificationRepository();
        var emails = new RecordingEmailSender();
        var dispatcher = new NotificationDispatcher(
            repository, emails, new HttpClient(), Options(),
            NullLogger<NotificationDispatcher>.Instance);

        await dispatcher.DispatchZoneMatchesAsync(
            Created(), [Match("sam@example.com")], CancellationToken.None);

        Assert.Equal(1, repository.Inserted);
        var recipient = Assert.Single(emails.Recipients);
        Assert.Equal("sam@example.com", recipient);
    }

    [Fact]
    public async Task ZoneWithoutEmailIsRecordedButNotEmailed()
    {
        var repository = new CountingNotificationRepository();
        var emails = new RecordingEmailSender();
        var dispatcher = new NotificationDispatcher(
            repository, emails, new HttpClient(), Options(),
            NullLogger<NotificationDispatcher>.Instance);

        await dispatcher.DispatchZoneMatchesAsync(
            Created(), [Match(null)], CancellationToken.None);

        Assert.Equal(1, repository.Inserted);
        Assert.Empty(emails.Recipients);
    }
}
