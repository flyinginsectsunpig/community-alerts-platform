using AlertProcessor;
using WebPush;
using Xunit;

namespace AlertProcessor.Tests;

/// <summary>
/// Push config used to fail invisibly: WebPushSender disables itself when a
/// value is missing, and a malformed one throws per-send inside a caught block.
/// Both states ran unnoticed in production for weeks, so startup validates instead.
/// </summary>
public class PushConfigurationTests
{
    private static WorkerOptions Options(string? publicKey, string? privateKey, string? subject) => new()
    {
        PostgresConnectionString = "Host=localhost;Database=test",
        RedisConfiguration = "localhost:6379",
        RabbitHost = "localhost",
        RabbitPort = 5672,
        RabbitUser = "guest",
        RabbitPassword = "guest",
        RabbitVhost = "/",
        RabbitSsl = false,
        VapidPublicKey = publicKey,
        VapidPrivateKey = privateKey,
        VapidSubject = subject,
    };

    [Fact]
    public void AllowsPushToBeEntirelyUnconfigured()
    {
        // Leaving all three unset is a deliberate choice (local runs, or a
        // deployment that does not want push) and must not stop the worker.
        Options(null, null, null).ValidatePushConfiguration();
    }

    [Fact]
    public void AcceptsAFullyValidConfiguration()
    {
        var keys = VapidHelper.GenerateVapidKeys();
        Options(keys.PublicKey, keys.PrivateKey, "mailto:alerts@example.com")
            .ValidatePushConfiguration();
    }

    [Theory]
    [InlineData(true, true, false)]   // keys without a subject
    [InlineData(true, false, true)]   // no private key
    [InlineData(false, true, true)]   // no public key
    public void RejectsPartiallyConfiguredPush(bool hasPublic, bool hasPrivate, bool hasSubject)
    {
        var keys = VapidHelper.GenerateVapidKeys();
        var options = Options(
            hasPublic ? keys.PublicKey : null,
            hasPrivate ? keys.PrivateKey : null,
            hasSubject ? "mailto:alerts@example.com" : null);

        var ex = Assert.Throws<InvalidOperationException>(options.ValidatePushConfiguration);
        Assert.Contains("VAPID", ex.Message);
    }

    [Theory]
    [InlineData("alerts@example.com")]  // missing the mailto: scheme
    [InlineData("not a url at all")]
    // The literal text that a shell failed to expand, which is how this broke.
    [InlineData("$(grep -m1 '^VAPID_SUBJECT=' .env | cut -d= -f2-)")]
    public void RejectsAMalformedSubject(string subject)
    {
        var keys = VapidHelper.GenerateVapidKeys();
        var options = Options(keys.PublicKey, keys.PrivateKey, subject);

        var ex = Assert.Throws<InvalidOperationException>(options.ValidatePushConfiguration);
        Assert.Contains("VAPID_SUBJECT", ex.Message);
    }

    [Fact]
    public void RejectsMalformedKeys()
    {
        var options = Options("not-a-key", "also-not-a-key", "mailto:alerts@example.com");

        var ex = Assert.Throws<InvalidOperationException>(options.ValidatePushConfiguration);
        Assert.Contains("VAPID", ex.Message);
    }
}
