using CommunityAlerts.Notifications.DTOs;
using System.Text.Json;

namespace CommunityAlerts.Notifications.BackgroundServices;

/// <summary>
/// Polls the Spring Boot backend every 5 minutes for suburbs that have
/// transitioned to RED status and fires notifications proactively.
///
/// This acts as a safety net alongside the webhook — if the Spring Boot
/// service fails to fire a webhook (network blip, deployment), this
/// background worker will catch any RED suburbs on the next poll cycle.
///
/// In production, replace polling with a proper message queue (RabbitMQ
/// or Azure Service Bus) for guaranteed delivery.
/// </summary>
public class SuburbPollingWorker : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(5);

    private readonly IHttpClientFactory _http;
    private readonly IServiceScopeFactory _scope;
    private readonly ILogger<SuburbPollingWorker> _logger;

    public SuburbPollingWorker(
        IHttpClientFactory http,
        IServiceScopeFactory scope,
        ILogger<SuburbPollingWorker> logger)
    {
        _http   = http;
        _scope  = scope;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        _logger.LogInformation("Suburb polling worker started. Interval={Interval}", PollInterval);

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await PollAsync(ct);
                await Task.Delay(PollInterval, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
        }
    }

    private async Task PollAsync(CancellationToken ct)
    {
        try
        {
            var client = _http.CreateClient("SpringBoot");
            var json   = await client.GetStringAsync("/api/v1/suburbs", ct);

            var suburbs = JsonSerializer.Deserialize<List<SuburbDto>>(
                json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (suburbs is null) return;

            var redSuburbs = suburbs.Where(s => s.AlertLevel == "RED").ToList();
            if (!redSuburbs.Any()) return;

            _logger.LogInformation("Polling found {Count} RED suburbs", redSuburbs.Count);

            using var serviceScope = _scope.CreateScope();
            var notificationService = serviceScope.ServiceProvider
                .GetRequiredService<Services.INotificationService>();

            foreach (var suburb in redSuburbs)
            {
                var alert = new SuburbAlertWebhookRequest(
                    SuburbId:          suburb.Id,
                    SuburbName:        suburb.Name,
                    HeatScore:         suburb.HeatScore,
                    AlertLevel:        suburb.AlertLevel,
                    PreviousAlertLevel: "ORANGE",     // polling doesn't know previous
                    IncidentCount:     suburb.IncidentCount,
                    TriggeredAt:       DateTime.UtcNow
                );

                await notificationService.ProcessAlertAsync(alert, ct);
            }
        }
        catch (HttpRequestException ex)
        {
            // Spring Boot is down — this is expected during deployments
            _logger.LogWarning(ex, "Spring Boot service unreachable during poll. Will retry.");
        }
        catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
        {
            // HttpClient timeout from downstream dependency.
            _logger.LogWarning(ex, "Spring Boot request timed out during poll. Will retry.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during suburb poll");
        }
    }

    private record SuburbDto(
        string Id, string Name, int HeatScore, string AlertLevel, int IncidentCount);
}
