using AlertProcessor.Data;
using AlertProcessor.Notifications;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AlertProcessor.Processing;

/// <summary>
/// Sends the opt-in watch-zone email digests: DAILY every run, WEEKLY on
/// Mondays, at 04:00 UTC (06:00 SAST). Email delivery is skipped upstream
/// when Resend is not configured.
/// </summary>
public sealed class DigestService(
    IDigestRepository digestRepository,
    IEmailSender emailSender,
    ILogger<DigestService> logger) : BackgroundService
{
    private static readonly TimeSpan RunTimeUtc = TimeSpan.FromHours(4);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTimeOffset.UtcNow;
            await Task.Delay(NextRunUtc(now) - now, stoppingToken);
            try
            {
                await RunOnceAsync(DateTimeOffset.UtcNow, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Digest run failed; retrying tomorrow");
            }
        }
    }

    public static DateTimeOffset NextRunUtc(DateTimeOffset nowUtc)
    {
        var todayRun = new DateTimeOffset(nowUtc.Date, TimeSpan.Zero) + RunTimeUtc;
        return nowUtc < todayRun ? todayRun : todayRun.AddDays(1);
    }

    internal async Task RunOnceAsync(DateTimeOffset nowUtc, CancellationToken ct)
    {
        await SendDigestsAsync("DAILY", nowUtc.AddDays(-1), "day", ct);
        if (nowUtc.DayOfWeek == DayOfWeek.Monday)
        {
            await SendDigestsAsync("WEEKLY", nowUtc.AddDays(-7), "week", ct);
        }
    }

    private async Task SendDigestsAsync(
        string frequency, DateTimeOffset since, string periodLabel, CancellationToken ct)
    {
        var rows = await digestRepository.GetDigestRowsAsync(frequency, since, ct);
        var emails = DigestComposer.Compose(rows, periodLabel);
        foreach (var (email, subject, html) in emails)
        {
            await emailSender.SendAsync(email, subject, html, ct);
        }
        if (emails.Count > 0)
        {
            logger.LogInformation("Sent {Count} {Frequency} digest(s)", emails.Count, frequency);
        }
    }
}
