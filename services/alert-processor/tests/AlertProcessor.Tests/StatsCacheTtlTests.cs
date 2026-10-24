using AlertProcessor;
using Xunit;

namespace AlertProcessor.Tests;

/// <summary>
/// The stats snapshot used to be written with no expiry, on the reasoning that
/// every ingested alert overwrites it. Nothing else recomputes it, so a quiet
/// week left the dashboard serving a snapshot whose 7-day window had long since
/// rolled past — 36 days stale in production, still labelled "live". The key
/// now carries a lifetime, and a zero or negative one would silently mean
/// "never expires" to Redis and put the bug straight back.
/// </summary>
public class StatsCacheTtlTests
{
    private static WorkerOptions Options(TimeSpan? ttl = null)
    {
        var options = new WorkerOptions
        {
            PostgresConnectionString = "Host=localhost;Database=test",
            RedisConfiguration = "localhost:6379",
            RabbitHost = "localhost",
            RabbitPort = 5672,
            RabbitUser = "guest",
            RabbitPassword = "guest",
            RabbitVhost = "/",
            RabbitSsl = false,
        };
        return ttl is null ? options : options with { StatsCacheTtl = ttl.Value };
    }

    [Fact]
    public void DefaultsToFifteenMinutes()
    {
        Assert.Equal(TimeSpan.FromMinutes(15), Options().StatsCacheTtl);
    }

    [Fact]
    public void AcceptsAPositiveLifetime()
    {
        Options(TimeSpan.FromMinutes(5)).ValidateStatsCacheTtl();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void RejectsALifetimeThatWouldNeverExpire(int seconds)
    {
        var options = Options(TimeSpan.FromSeconds(seconds));

        var error = Assert.Throws<InvalidOperationException>(options.ValidateStatsCacheTtl);
        Assert.Contains("STATS_CACHE_TTL_SECONDS", error.Message);
    }
}
