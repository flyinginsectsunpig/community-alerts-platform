using System.Data;
using Dapper;

namespace AlertProcessor.Data;

/// <summary>
/// Dapper's global type mapping. Registered once at startup from Program.cs.
/// </summary>
public static class DapperConfiguration
{
    private static bool registered;

    /// <summary>
    /// Idempotent — Dapper's handler table is process-wide static state, and
    /// tests register it too.
    /// </summary>
    public static void Register()
    {
        if (registered)
        {
            return;
        }

        SqlMapper.AddTypeHandler(new DateTimeOffsetHandler());
        registered = true;
    }
}

/// <summary>
/// Npgsql surfaces TIMESTAMPTZ as a UTC <see cref="DateTime"/>, not a
/// <see cref="DateTimeOffset"/>. Dapper matches a record's constructor by
/// comparing each parameter's type to the column's type and requires them to be
/// equal unless a handler is registered for that type, so without this every
/// record carrying a DateTimeOffset (ExpiredAlert, DigestRow) fails to
/// materialise with "no matching signature".
/// </summary>
public sealed class DateTimeOffsetHandler : SqlMapper.TypeHandler<DateTimeOffset>
{
    public override DateTimeOffset Parse(object value) => value switch
    {
        DateTimeOffset offset => offset,
        // SpecifyKind guards the Unspecified case: constructing a DateTimeOffset
        // from it would apply the host's local offset and shift the instant.
        DateTime timestamp => new DateTimeOffset(DateTime.SpecifyKind(timestamp, DateTimeKind.Utc)),
        _ => throw new DataException(
            $"Cannot convert {value?.GetType().FullName ?? "null"} to DateTimeOffset"),
    };

    public override void SetValue(IDbDataParameter parameter, DateTimeOffset value)
        => parameter.Value = value.UtcDateTime;
}
