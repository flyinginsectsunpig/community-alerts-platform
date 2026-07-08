using AlertProcessor.Processing;
using Xunit;

namespace AlertProcessor.Tests;

public class EscalationHandlerTests
{
    private static AlertScoredEvent Scored(string severity, double riskScore) => new(
        Guid.NewGuid(), severity, riskScore, "model-1",
        "ASSAULT", 51.5074, -0.1278, DateTimeOffset.UtcNow);

    [Theory]
    [InlineData("CRITICAL", 0.90, true)]
    [InlineData("CRITICAL", 0.10, true)] // CRITICAL always escalates
    [InlineData("HIGH", 0.80, true)]
    [InlineData("HIGH", 0.50, false)]
    [InlineData("MEDIUM", 0.99, false)]
    [InlineData("LOW", 0.99, false)]
    [InlineData("UNSCORED", 0.99, false)]
    public void OnlyDangerousAlertsEscalate(string severity, double riskScore, bool expected)
    {
        Assert.Equal(expected, EscalationHandler.IsEscalatable(Scored(severity, riskScore)));
    }
}
