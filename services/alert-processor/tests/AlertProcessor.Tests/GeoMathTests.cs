using AlertProcessor.Domain;
using AlertProcessor.Geo;
using Xunit;

namespace AlertProcessor.Tests;

public class GeoMathTests
{
    [Fact]
    public void DistanceBetweenIdenticalPointsIsZero()
    {
        Assert.Equal(0, GeoMath.DistanceMeters(51.5074, -0.1278, 51.5074, -0.1278), precision: 6);
    }

    [Fact]
    public void DistanceMatchesKnownLandmarkSeparation()
    {
        // Trafalgar Square -> Tower Bridge is roughly 3.9 km.
        var distance = GeoMath.DistanceMeters(51.5080, -0.1281, 51.5055, -0.0754);
        Assert.InRange(distance, 3600, 4000);
    }

    [Fact]
    public void DistanceIsSymmetric()
    {
        var forward = GeoMath.DistanceMeters(40.7128, -74.0060, 34.0522, -118.2437);
        var backward = GeoMath.DistanceMeters(34.0522, -118.2437, 40.7128, -74.0060);
        Assert.Equal(forward, backward, precision: 6);
    }

    [Fact]
    public void ContainsPointInsideAndOutsideSquare()
    {
        GeoPoint[] square = [new(0, 0), new(0, 1), new(1, 1), new(1, 0)];

        Assert.True(GeoMath.ContainsPoint(square, 0.5, 0.5));
        Assert.False(GeoMath.ContainsPoint(square, 1.5, 0.5));
        Assert.False(GeoMath.ContainsPoint(square, 0.5, -0.5));
        Assert.False(GeoMath.ContainsPoint(square, -0.1, 0.5));
        Assert.False(GeoMath.ContainsPoint(square, 0.5, 1.1));
    }
}
