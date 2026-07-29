using System.Data;
using AlertProcessor.Data;
using AlertProcessor.Domain;
using Dapper;
using Xunit;

namespace AlertProcessor.Tests;

/// <summary>
/// The sweep's own tests build <see cref="ExpiredAlert"/> in C# and only assert
/// the JSON shape, so nothing covered the SQL-to-object step — the expiry sweep
/// threw on every run in production while CI stayed green. These tests exercise
/// Dapper's materialisation against the column types Npgsql actually returns.
/// </summary>
public class ExpiredAlertMappingTests
{
    // The same registration Program.cs performs at startup; these tests are
    // asserting that production's Dapper configuration can read these rows.
    static ExpiredAlertMappingTests() => DapperConfiguration.Register();

    /// <summary>
    /// Mirrors the reader behind the sweep's RETURNING clause. The column types
    /// are the ones Npgsql reports for that query — note TIMESTAMPTZ surfaces as
    /// DateTime, which is what the record has to be able to accept.
    /// </summary>
    private static IDataReader ReaderForOneRow(Guid id, DateTime createdAt, DateTime updatedAt)
    {
        var table = new DataTable();
        table.Columns.Add("id", typeof(Guid));
        table.Columns.Add("category", typeof(string));
        table.Columns.Add("description", typeof(string));
        table.Columns.Add("lat", typeof(double));
        table.Columns.Add("lng", typeof(double));
        table.Columns.Add("severity", typeof(string));
        table.Columns.Add("RiskScore", typeof(double));
        table.Columns.Add("status", typeof(string));
        table.Columns.Add("ConfirmationCount", typeof(int));
        table.Columns.Add("CommentCount", typeof(int));
        table.Columns.Add("ReportedByUserId", typeof(Guid));
        table.Columns.Add("CreatedAt", typeof(DateTime));
        table.Columns.Add("UpdatedAt", typeof(DateTime));
        table.Rows.Add(
            id, "THEFT", "Bike stolen", 51.5074, -0.1278, "HIGH",
            0.72, "EXPIRED", 2, 1, Guid.NewGuid(), createdAt, updatedAt);
        return table.CreateDataReader();
    }

    [Fact]
    public void MaterializesRowsWhoseTimestampsArriveAsDateTime()
    {
        var id = Guid.NewGuid();
        var createdAt = new DateTime(2026, 7, 20, 8, 30, 0, DateTimeKind.Utc);
        var updatedAt = new DateTime(2026, 7, 29, 13, 45, 0, DateTimeKind.Utc);

        using var reader = ReaderForOneRow(id, createdAt, updatedAt);
        var parse = reader.GetRowParser<ExpiredAlert>();
        Assert.True(reader.Read());

        var alert = parse(reader);

        Assert.Equal(id, alert.Id);
        Assert.Equal("EXPIRED", alert.Status);
        Assert.Equal(0.72, alert.RiskScore);
        Assert.Equal(createdAt, alert.CreatedAt.UtcDateTime);
        Assert.Equal(updatedAt, alert.UpdatedAt.UtcDateTime);
        // Timestamps are UTC instants; a non-zero offset would shift them when
        // the payload is serialised onto alerts.live.
        Assert.Equal(TimeSpan.Zero, alert.CreatedAt.Offset);
    }

    [Fact]
    public void TreatsNullRiskScoreAndReporterAsAbsent()
    {
        var table = new DataTable();
        table.Columns.Add("id", typeof(Guid));
        table.Columns.Add("RiskScore", typeof(double));
        table.Columns.Add("ReportedByUserId", typeof(Guid));
        table.Columns.Add("CreatedAt", typeof(DateTime));
        table.Rows.Add(Guid.NewGuid(), DBNull.Value, DBNull.Value, DateTime.UtcNow);
        using var reader = table.CreateDataReader();

        var parse = reader.GetRowParser<UnscoredRow>();
        Assert.True(reader.Read());
        var row = parse(reader);

        Assert.Null(row.RiskScore);
        Assert.Null(row.ReportedByUserId);
    }

    /// <summary>Narrow stand-in for the nullable columns on the sweep's query.</summary>
    private sealed record UnscoredRow(
        Guid Id, double? RiskScore, Guid? ReportedByUserId, DateTimeOffset CreatedAt);
}
