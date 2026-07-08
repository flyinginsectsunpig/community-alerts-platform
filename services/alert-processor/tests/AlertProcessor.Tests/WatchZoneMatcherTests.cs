using AlertProcessor.Domain;
using AlertProcessor.Processing;
using Xunit;

namespace AlertProcessor.Tests;

public class WatchZoneMatcherTests
{
    private readonly WatchZoneMatcher _matcher = new();

    // ~500 m north of the zone center at this latitude.
    private const double CenterLat = 51.5074;
    private const double CenterLng = -0.1278;
    private const double NearbyLat = 51.5119;

    private static WatchZone Zone(int radiusM, params string[] categories) => new(
        Guid.NewGuid(), "Test zone", "resident@example.com",
        CenterLat, CenterLng, radiusM, categories);

    [Fact]
    public void AlertInsideRadiusMatches()
    {
        var matches = _matcher.FindMatches([Zone(1000)], NearbyLat, CenterLng, "THEFT");

        var match = Assert.Single(matches);
        Assert.InRange(match.DistanceMeters, 400, 600);
    }

    [Fact]
    public void AlertOutsideRadiusDoesNotMatch()
    {
        var matches = _matcher.FindMatches([Zone(300)], NearbyLat, CenterLng, "THEFT");

        Assert.Empty(matches);
    }

    [Fact]
    public void CategorySubscriptionFiltersMismatches()
    {
        var zones = new[] { Zone(1000, "VANDALISM", "HAZARD") };

        Assert.Empty(_matcher.FindMatches(zones, NearbyLat, CenterLng, "THEFT"));
        Assert.Single(_matcher.FindMatches(zones, NearbyLat, CenterLng, "HAZARD"));
    }

    [Fact]
    public void CategoryComparisonIsCaseInsensitive()
    {
        var zones = new[] { Zone(1000, "theft") };

        Assert.Single(_matcher.FindMatches(zones, NearbyLat, CenterLng, "THEFT"));
    }

    [Fact]
    public void EmptyCategoryListSubscribesToEverything()
    {
        var zones = new[] { Zone(1000) };

        Assert.Single(_matcher.FindMatches(zones, NearbyLat, CenterLng, "DRUGS"));
    }

    [Fact]
    public void RadiusMultiplierWidensTheMatchArea()
    {
        var zones = new[] { Zone(300) };

        Assert.Empty(_matcher.FindMatches(zones, NearbyLat, CenterLng, "THEFT"));
        Assert.Single(_matcher.FindMatches(zones, NearbyLat, CenterLng, "THEFT", radiusMultiplier: 2.0));
    }

    [Fact]
    public void IgnoreCategoriesBypassesSubscriptions()
    {
        var zones = new[] { Zone(1000, "VANDALISM") };

        var matches = _matcher.FindMatches(
            zones, NearbyLat, CenterLng, "ASSAULT", ignoreCategories: true);

        Assert.Single(matches);
    }

    [Fact]
    public void MatchesAreOrderedByDistance()
    {
        var near = Zone(5000) with { Id = Guid.NewGuid() };
        var far = new WatchZone(
            Guid.NewGuid(), "Far zone", "far@example.com",
            CenterLat + 0.02, CenterLng, 5000, []);

        var matches = _matcher.FindMatches([far, near], NearbyLat, CenterLng, "THEFT");

        Assert.Equal(2, matches.Count);
        Assert.True(matches[0].DistanceMeters < matches[1].DistanceMeters);
        Assert.Equal(near.Id, matches[0].Zone.Id);
    }

    [Fact]
    public void InvalidRadiusMultiplierIsRejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(
            () => _matcher.FindMatches([Zone(1000)], NearbyLat, CenterLng, "THEFT", radiusMultiplier: 0));
    }
}
