using AlertProcessor.Data;
using Npgsql;
using Xunit;

namespace AlertProcessor.Tests;

public class PostgresPoolingTests
{
    // Same shape as the real secret (see .env.example), with dummy values.
    private const string Connection =
        "Host=ep-example.eu-west-2.aws.neon.tech;Database=neondb;Username=someone;" +
        "Password=placeholder;SSL Mode=Require;Channel Binding=Require";

    [Fact]
    public void ShortensTheIdleLifetimeFromNpgsqlsDefault()
    {
        var built = new NpgsqlConnectionStringBuilder(PostgresPooling.WithIdleLifetime(Connection));

        Assert.Equal(PostgresPooling.IdleLifetimeSeconds, built.ConnectionIdleLifetime);
        // The default is what kept Neon's compute awake between sweeps.
        Assert.True(built.ConnectionIdleLifetime < 300);
    }

    // The worker cannot reach Neon without TLS, so silently dropping either of
    // these on the round-trip would break startup rather than degrade it.
    [Fact]
    public void PreservesTheTlsSettingsNeonRequires()
    {
        var built = new NpgsqlConnectionStringBuilder(PostgresPooling.WithIdleLifetime(Connection));

        Assert.Equal(SslMode.Require, built.SslMode);
        Assert.Equal(ChannelBinding.Require, built.ChannelBinding);
    }

    [Fact]
    public void PreservesHostDatabaseAndCredentials()
    {
        var built = new NpgsqlConnectionStringBuilder(PostgresPooling.WithIdleLifetime(Connection));

        Assert.Equal("ep-example.eu-west-2.aws.neon.tech", built.Host);
        Assert.Equal("neondb", built.Database);
        Assert.Equal("someone", built.Username);
        Assert.Equal("placeholder", built.Password);
    }
}
