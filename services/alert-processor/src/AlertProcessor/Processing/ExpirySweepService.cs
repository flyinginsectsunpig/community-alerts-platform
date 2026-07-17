using System.Text.Json;
using AlertProcessor.Data;
using AlertProcessor.Domain;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace AlertProcessor.Processing;

/// <summary>
/// Periodically flips overdue alerts to EXPIRED and publishes each change to
/// the <c>alerts.live</c> Redis channel so open dashboards drop the pins in
/// real time. The payload hand-mirrors the Java API's SSE event shape
/// (AlertService.LiveEvent); a publish failure is logged, never fatal — the
/// next nearby query filters expired alerts out regardless.
/// </summary>
public sealed class ExpirySweepService(
    IAlertExpiryRepository expiryRepository,
    IConnectionMultiplexer redis,
    ILogger<ExpirySweepService> logger) : BackgroundService
{
    private static readonly TimeSpan SweepInterval = TimeSpan.FromMinutes(5);
    private const string LiveChannel = "alerts.live";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(SweepInterval);
        do
        {
            try
            {
                await SweepOnceAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Expiry sweep failed; retrying next interval");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task SweepOnceAsync(CancellationToken ct)
    {
        var expired = await expiryRepository.ExpireOverdueAsync(ct);
        if (expired.Count == 0)
        {
            return;
        }

        logger.LogInformation("Expired {Count} overdue alert(s)", expired.Count);
        var subscriber = redis.GetSubscriber();
        foreach (var alert in expired)
        {
            try
            {
                await subscriber.PublishAsync(
                    RedisChannel.Literal(LiveChannel), SerializeLiveEvent(alert));
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Failed to publish expiry of alert {AlertId}", alert.Id);
            }
        }
    }

    public static string SerializeLiveEvent(ExpiredAlert alert) =>
        JsonSerializer.Serialize(new LiveAlertEvent("alert.updated", alert), JsonDefaults.Options);

    private sealed record LiveAlertEvent(string Type, ExpiredAlert Alert);
}
