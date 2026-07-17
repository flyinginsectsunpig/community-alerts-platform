using AlertProcessor.Notifications;
using Xunit;

namespace AlertProcessor.Tests;

public class EmailComposerTests
{
    [Theory]
    [InlineData("SUSPICIOUS_ACTIVITY", "suspicious activity")]
    [InlineData("THEFT", "theft")]
    public void HumanizeLowercasesAndUnderscores(string category, string expected)
    {
        Assert.Equal(expected, EmailComposer.Humanize(category));
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
