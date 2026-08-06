using Npgsql;

namespace AlertProcessor.Data;

/// <summary>
/// Pooling settings for the worker's Postgres connections.
/// </summary>
public static class PostgresPooling
{
    /// <summary>
    /// How long an unused pooled connection is kept open, in seconds.
    ///
    /// Npgsql's default is 300s, which exactly matched the old five-minute
    /// expiry sweep: the connection was recreated the instant it would have
    /// been pruned, so Neon saw an unbroken connection, never autosuspended,
    /// and the monthly compute quota ran out — taking production down. Well
    /// under the sweep interval, the connection closes and the compute is
    /// allowed to sleep between ticks.
    /// </summary>
    public const int IdleLifetimeSeconds = 30;

    /// <summary>
    /// Applied in code rather than baked into the connection string so it holds
    /// wherever the worker runs and cannot drift between the local .env and the
    /// Container App's secret.
    /// </summary>
    public static string WithIdleLifetime(string connectionString) =>
        new NpgsqlConnectionStringBuilder(connectionString)
        {
            ConnectionIdleLifetime = IdleLifetimeSeconds,
        }.ConnectionString;
}
