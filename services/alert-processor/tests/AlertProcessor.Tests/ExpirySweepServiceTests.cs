using System.Text.Json;
using AlertProcessor.Domain;
using AlertProcessor.Processing;
using Xunit;

namespace AlertProcessor.Tests;

public class ExpirySweepServiceTests
{
    private static ExpiredAlert Expired() => new(
        Guid.NewGuid(), "THEFT", "Bike stolen", 51.5074, -0.1278,
        "HIGH", 0.72, "EXPIRED", 2, 1, Guid.NewGuid(),
        DateTimeOffset.UtcNow.AddDays(-4), DateTimeOffset.UtcNow);

    [Fact]
    public void LiveEventJsonMatchesTheApiSseShape()
    {
        // The web app consumes this exact shape from the API's SSE bridge
        // (AlertService.LiveEvent + AlertResponse, camelCase) — the sweep's
        // payload must be indistinguishable from an API-published update.
        var json = ExpirySweepService.SerializeLiveEvent(Expired());

        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        Assert.Equal("alert.updated", root.GetProperty("type").GetString());

        var alert = root.GetProperty("alert");
        Assert.Equal("EXPIRED", alert.GetProperty("status").GetString());
        foreach (var property in new[]
                 {
                     "id", "category", "description", "lat", "lng", "severity",
                     "riskScore", "status", "confirmationCount", "commentCount",
                     "reportedByUserId", "createdAt", "updatedAt",
                 })
        {
            Assert.True(alert.TryGetProperty(property, out _), $"missing property '{property}'");
        }
    }
}
