using AlertProcessor.Data;
using AlertProcessor.Domain;
using AlertProcessor.Notifications;
using AlertProcessor.Processing;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AlertProcessor.Tests;

public class DigestComposerTests
{
    private static DigestRow Row(string email, string zone, string message) =>
        new(email, zone, message, DateTimeOffset.UtcNow);

    [Fact]
    public void GroupsAllOfARecipientsZonesIntoOneEmail()
    {
        var emails = DigestComposer.Compose(
        [
            Row("sam@example.com", "Home", "New theft report 200 m away."),
            Row("sam@example.com", "School run", "New hazard report 500 m away."),
            Row("alex@example.com", "Work", "New theft report 100 m away."),
        ], "day");

        Assert.Equal(2, emails.Count);
        var sam = Assert.Single(emails, e => e.Email == "sam@example.com");
        Assert.Contains("2 notifications", sam.Subject);
        Assert.Contains("Home", sam.Html);
        Assert.Contains("School run", sam.Html);
    }

    [Fact]
    public void UserGeneratedContentIsHtmlEncoded()
    {
        var emails = DigestComposer.Compose(
            [Row("sam@example.com", "<script>zone</script>", "safe message")], "day");

        var email = Assert.Single(emails);
        Assert.DoesNotContain("<script>", email.Html);
        Assert.Contains("&lt;script&gt;", email.Html);
    }

    [Fact]
    public void NoRowsMeansNoEmails()
    {
        Assert.Empty(DigestComposer.Compose([], "week"));
    }
}

public class DigestServiceTests
{
    private sealed class FakeDigestRepository(Dictionary<string, IReadOnlyList<DigestRow>> byFrequency)
        : IDigestRepository
    {
        public List<string> QueriedFrequencies { get; } = [];

        public Task<IReadOnlyList<DigestRow>> GetDigestRowsAsync(
            string frequency, DateTimeOffset since, CancellationToken ct)
        {
            QueriedFrequencies.Add(frequency);
            return Task.FromResult(byFrequency.TryGetValue(frequency, out var rows)
                ? rows
                : (IReadOnlyList<DigestRow>)[]);
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

    [Theory]
    [InlineData("2026-07-17T02:30:00Z", "2026-07-17T04:00:00Z")] // before 04:00 → same day
    [InlineData("2026-07-17T04:00:00Z", "2026-07-18T04:00:00Z")] // at/after → next day
    [InlineData("2026-07-17T23:59:00Z", "2026-07-18T04:00:00Z")]
    public void NextRunIsFourUtc(string now, string expected)
    {
        Assert.Equal(
            DateTimeOffset.Parse(expected),
            DigestService.NextRunUtc(DateTimeOffset.Parse(now)));
    }

    [Fact]
    public async Task WeeklyDigestsGoOutOnlyOnMondays()
    {
        var repository = new FakeDigestRepository(new Dictionary<string, IReadOnlyList<DigestRow>>
        {
            ["DAILY"] = [new DigestRow("daily@example.com", "Home", "msg", DateTimeOffset.UtcNow)],
            ["WEEKLY"] = [new DigestRow("weekly@example.com", "Home", "msg", DateTimeOffset.UtcNow)],
        });
        var emails = new RecordingEmailSender();
        var service = new DigestService(repository, emails, NullLogger<DigestService>.Instance);

        // 2026-07-17 is a Friday: daily only.
        await service.RunOnceAsync(DateTimeOffset.Parse("2026-07-17T04:00:00Z"), CancellationToken.None);
        Assert.Equal(["daily@example.com"], emails.Recipients);
        Assert.Equal(["DAILY"], repository.QueriedFrequencies);

        // 2026-07-20 is a Monday: daily and weekly.
        await service.RunOnceAsync(DateTimeOffset.Parse("2026-07-20T04:00:00Z"), CancellationToken.None);
        Assert.Equal(["daily@example.com", "daily@example.com", "weekly@example.com"], emails.Recipients);
    }
}
