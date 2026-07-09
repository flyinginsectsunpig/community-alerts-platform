using AlertProcessor.Domain;
using AlertProcessor.Notifications;
using Xunit;

namespace AlertProcessor.Tests;

public class EmailComposerTests
{
    private static readonly WatchZone Zone = new(
        Guid.NewGuid(), "School run", "parent@example.com", 51.5074, -0.1278, 1000, []);

    private static AlertCreatedEvent Created(string description) => new(
        Guid.NewGuid(), "SUSPICIOUS_ACTIVITY", description, 51.51, -0.13, DateTimeOffset.UtcNow);

    [Fact]
    public void ZoneMatchSubjectNamesCategoryDistanceAndZone()
    {
        var (subject, _) = EmailComposer.ZoneMatch(
            Created("Man trying car door handles"), new ZoneMatch(Zone, 350));

        Assert.Equal("New suspicious activity report 350 m from 'School run'", subject);
    }

    [Fact]
    public void UserGeneratedContentIsHtmlEncoded()
    {
        var (_, html) = EmailComposer.ZoneMatch(
            Created("<script>alert('xss')</script>"), new ZoneMatch(Zone, 100));

        Assert.DoesNotContain("<script>", html);
        Assert.Contains("&lt;script&gt;", html);
    }

    [Fact]
    public void EscalationSubjectLeadsWithSeverity()
    {
        var scored = new AlertScoredEvent(
            Guid.NewGuid(), "CRITICAL", 0.95, "model-1", "ASSAULT", 51.51, -0.13, DateTimeOffset.UtcNow);

        var (subject, html) = EmailComposer.Escalation(scored, new ZoneMatch(Zone, 1500));

        Assert.StartsWith("CRITICAL alert: assault 1.5 km from 'School run'", subject);
        Assert.Contains("0.95", html);
    }

    [Theory]
    [InlineData(0, "0 m")]
    [InlineData(999, "999 m")]
    [InlineData(1000, "1.0 km")]
    [InlineData(2350, "2.4 km")]
    public void DistancesFormatAsMetersThenKilometers(double meters, string expected)
    {
        Assert.Equal(expected, EmailComposer.FormatDistance(meters));
    }
}
