using AlertProcessor.Domain;
using Dapper;
using Npgsql;

namespace AlertProcessor.Data;

public sealed class PostgresWatchZoneRepository(NpgsqlDataSource dataSource) : IWatchZoneRepository
{
    private sealed record Row(
        Guid Id, string Name, string? ContactEmail,
        double CenterLat, double CenterLng, int RadiusM, string Categories);

    public async Task<IReadOnlyList<WatchZone>> GetAllAsync(CancellationToken ct)
    {
        const string sql = """
            SELECT id, name, contact_email AS ContactEmail,
                   center_lat AS CenterLat, center_lng AS CenterLng,
                   radius_m AS RadiusM, categories
            FROM watch_zones
            """;

        await using var connection = await dataSource.OpenConnectionAsync(ct);
        var rows = await connection.QueryAsync<Row>(new CommandDefinition(sql, cancellationToken: ct));

        return rows.Select(r => new WatchZone(
                r.Id, r.Name, r.ContactEmail, r.CenterLat, r.CenterLng, r.RadiusM,
                r.Categories.Length == 0
                    ? Array.Empty<string>()
                    : r.Categories.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)))
            .ToList();
    }
}

public sealed class PostgresNotificationRepository(NpgsqlDataSource dataSource) : INotificationRepository
{
    public async Task<int> InsertAsync(Guid watchZoneId, Guid alertId, string kind, string message, CancellationToken ct)
    {
        const string sql = """
            INSERT INTO notifications (watch_zone_id, alert_id, kind, message)
            VALUES (@watchZoneId, @alertId, @kind, @message)
            ON CONFLICT ON CONSTRAINT uq_notification DO NOTHING
            """;

        await using var connection = await dataSource.OpenConnectionAsync(ct);
        return await connection.ExecuteAsync(new CommandDefinition(
            sql, new { watchZoneId, alertId, kind, message }, cancellationToken: ct));
    }
}

public sealed class PostgresPushSubscriptionRepository(NpgsqlDataSource dataSource) : IPushSubscriptionRepository
{
    public async Task<IReadOnlyList<PushSubscriptionRow>> GetForZoneAsync(Guid zoneId, CancellationToken ct)
    {
        const string sql = """
            SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
            FROM push_subscriptions ps
            JOIN watch_zones wz ON (wz.user_id IS NOT NULL AND ps.user_id = wz.user_id)
                                OR (wz.owner_fingerprint IS NOT NULL
                                    AND ps.owner_fingerprint = wz.owner_fingerprint)
            WHERE wz.id = @zoneId
            """;

        await using var connection = await dataSource.OpenConnectionAsync(ct);
        var rows = await connection.QueryAsync<PushSubscriptionRow>(
            new CommandDefinition(sql, new { zoneId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task DeleteAsync(string endpoint, CancellationToken ct)
    {
        const string sql = "DELETE FROM push_subscriptions WHERE endpoint = @endpoint";
        await using var connection = await dataSource.OpenConnectionAsync(ct);
        await connection.ExecuteAsync(new CommandDefinition(sql, new { endpoint }, cancellationToken: ct));
    }
}

public sealed class PostgresAlertExpiryRepository(NpgsqlDataSource dataSource) : IAlertExpiryRepository
{
    public async Task<IReadOnlyList<ExpiredAlert>> ExpireOverdueAsync(CancellationToken ct)
    {
        const string sql = """
            UPDATE alerts SET status = 'EXPIRED', updated_at = now()
            WHERE status IN ('ACTIVE', 'VERIFIED') AND expires_at < now()
            RETURNING id, category, description, lat, lng, severity,
                      risk_score AS RiskScore, status,
                      confirmation_count AS ConfirmationCount,
                      comment_count AS CommentCount,
                      reported_by_user_id AS ReportedByUserId,
                      created_at AS CreatedAt, updated_at AS UpdatedAt
            """;

        await using var connection = await dataSource.OpenConnectionAsync(ct);
        var rows = await connection.QueryAsync<ExpiredAlert>(
            new CommandDefinition(sql, cancellationToken: ct));
        return rows.ToList();
    }
}

public sealed class PostgresStatsRepository(NpgsqlDataSource dataSource) : IStatsRepository
{
    public async Task<IReadOnlyList<CountRow>> GetCategoryCountsAsync(DateTimeOffset since, CancellationToken ct)
    {
        const string sql = """
            SELECT category AS Key, COUNT(*) AS Count
            FROM alerts WHERE created_at >= @since
            GROUP BY category ORDER BY Count DESC
            """;
        return await QueryAsync<CountRow>(sql, since, ct);
    }

    public async Task<IReadOnlyList<DayCount>> GetDailyCountsAsync(DateTimeOffset since, CancellationToken ct)
    {
        const string sql = """
            SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS Day, COUNT(*) AS Count
            FROM alerts WHERE created_at >= @since
            GROUP BY 1 ORDER BY 1
            """;
        return await QueryAsync<DayCount>(sql, since, ct);
    }

    public async Task<IReadOnlyList<CountRow>> GetSeverityCountsAsync(DateTimeOffset since, CancellationToken ct)
    {
        const string sql = """
            SELECT severity AS Key, COUNT(*) AS Count
            FROM alerts WHERE created_at >= @since
            GROUP BY severity ORDER BY Count DESC
            """;
        return await QueryAsync<CountRow>(sql, since, ct);
    }

    private async Task<IReadOnlyList<T>> QueryAsync<T>(string sql, DateTimeOffset since, CancellationToken ct)
    {
        await using var connection = await dataSource.OpenConnectionAsync(ct);
        var rows = await connection.QueryAsync<T>(new CommandDefinition(sql, new { since }, cancellationToken: ct));
        return rows.ToList();
    }
}
