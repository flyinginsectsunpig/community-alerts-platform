using AlertProcessor.Domain;
using AlertProcessor.Processing;
using Xunit;

namespace AlertProcessor.Tests;

public class OngoingDangerTests
{
    private const double AlertLat = 51.5074;
    private const double AlertLng = -0.1278;
    private const double MetersPerDegreeLat = 111_194.9;

    private static readonly DateTimeOffset Now = new(2026, 10, 25, 12, 0, 0, TimeSpan.Zero);

    private static AlertScoredEvent Scored(string severity = "CRITICAL", double risk = 0.9) => new(
        Guid.NewGuid(), severity, risk, "model-1", "ASSAULT", AlertLat, AlertLng, Now);

    private static AlertState State(
        string category = "ASSAULT",
        string status = "ACTIVE",
        bool ongoing = true,
        TimeSpan? age = null) => new(
        Guid.NewGuid(), category, status, ongoing, Now - (age ?? TimeSpan.FromMinutes(10)));

    // A zone whose centre sits due south of the alert, centerDistanceM away.
    private static WatchZone ZoneAt(double centerDistanceM, int radiusM) => new(
        Guid.NewGuid(), "Home", null,
        AlertLat - centerDistanceM / MetersPerDegreeLat, AlertLng, radiusM, []);

    [Fact]
    public void Qualifies_baselineAlertIsTrue()
    {
        Assert.True(OngoingDanger.Qualifies(Scored(), State(), Now));
    }

    [Fact]
    public void Qualifies_notOngoingIsFalse()
    {
        Assert.False(OngoingDanger.Qualifies(Scored(), State(ongoing: false), Now));
    }

    [Theory]
    [InlineData("THEFT")]
    public void Qualifies_otherCategoriesAreFalse(string category)
    {
        Assert.False(OngoingDanger.Qualifies(Scored(), State(category: category), Now));
    }

    [Fact]
    public void Qualifies_highSeverityIsFalseEvenWithHighRisk()
    {
        Assert.False(OngoingDanger.Qualifies(Scored("HIGH", 0.99), State(), Now));
    }

    [Theory]
    [InlineData("RESOLVED")]
    [InlineData("EXPIRED")]
    public void Qualifies_closedStatusesAreFalse(string status)
    {
        Assert.False(OngoingDanger.Qualifies(Scored(), State(status: status), Now));
    }

    [Fact]
    public void Qualifies_olderThanWindowIsFalse()
    {
        Assert.False(OngoingDanger.Qualifies(Scored(), State(age: TimeSpan.FromMinutes(61)), Now));
    }

    [Theory]
    [InlineData("HAZARD", "ACTIVE", 10)]
    [InlineData("OTHER", "ACTIVE", 10)]
    [InlineData("ASSAULT", "VERIFIED", 10)]
    [InlineData("ASSAULT", "ACTIVE", 60)] // exactly at the window edge still counts
    public void Qualifies_acceptedVariantsAreTrue(string category, string status, int ageMinutes)
    {
        var state = State(category: category, status: status, age: TimeSpan.FromMinutes(ageMinutes));

        Assert.True(OngoingDanger.Qualifies(Scored(), state, Now));
    }

    [Fact]
    public void EdgeDistance_insideCircleIsZero()
    {
        var zone = ZoneAt(centerDistanceM: 200, radiusM: 500);

        Assert.Equal(0, OngoingDanger.EdgeDistanceMeters(zone, AlertLat, AlertLng));
    }

    [Fact]
    public void EdgeDistance_outsideCircleIsDistanceMinusRadius()
    {
        var zone = ZoneAt(centerDistanceM: 3_000, radiusM: 500);

        var edge = OngoingDanger.EdgeDistanceMeters(zone, AlertLat, AlertLng);

        Assert.InRange(edge, 2_499, 2_501);
    }

    [Fact]
    public void SelectTargets_picksNearestZonePerUser()
    {
        var far = ZoneAt(4_500, 500);
        var near = ZoneAt(2_000, 500);
        var watcher = new DangerWatcher(Guid.NewGuid(), 5_000, [far, near]);

        var targets = OngoingDanger.SelectTargets([watcher], AlertLat, AlertLng);

        var target = Assert.Single(targets);
        Assert.Equal(near.Id, target.Zone.Id);
        Assert.InRange(target.EdgeDistanceMeters, 1_499, 1_501);
    }

    [Fact]
    public void SelectTargets_skipsUserBeyondReach()
    {
        var watcher = new DangerWatcher(Guid.NewGuid(), 5_000, [ZoneAt(6_500, 500)]);

        Assert.Empty(OngoingDanger.SelectTargets([watcher], AlertLat, AlertLng));
    }

    [Fact]
    public void SelectTargets_skipsUserAlreadyEscalated()
    {
        var escalated = ZoneAt(1_800, 1_000); // centre within 2x radius
        var farButInReach = ZoneAt(4_000, 500);
        var watcher = new DangerWatcher(Guid.NewGuid(), 5_000, [escalated, farButInReach]);

        Assert.Empty(OngoingDanger.SelectTargets([watcher], AlertLat, AlertLng));
    }

    [Fact]
    public void SelectTargets_ordersByDistance()
    {
        var nearZone = ZoneAt(2_000, 500);
        var farZone = ZoneAt(4_000, 500);
        var farUser = new DangerWatcher(Guid.NewGuid(), 5_000, [farZone]);
        var nearUser = new DangerWatcher(Guid.NewGuid(), 5_000, [nearZone]);

        var targets = OngoingDanger.SelectTargets([farUser, nearUser], AlertLat, AlertLng);

        Assert.Equal([nearZone.Id, farZone.Id], targets.Select(t => t.Zone.Id));
    }
}
