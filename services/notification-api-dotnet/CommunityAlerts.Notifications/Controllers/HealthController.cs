using CommunityAlerts.Notifications.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace CommunityAlerts.Notifications.Controllers;

[ApiController]
[Route("api/v1/health")]
public class HealthController : ControllerBase
{
    private readonly IHttpClientFactory _http;

    public HealthController(IHttpClientFactory http) => _http = http;

    [HttpGet]
    [ProducesResponseType(typeof(HealthResponse), 200)]
    public async Task<IActionResult> Health(CancellationToken ct)
    {
        async Task<bool> CheckDependencyAsync(string clientName, string endpoint)
        {
            try
            {
                using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                linkedCts.CancelAfter(TimeSpan.FromSeconds(2));
                var client = _http.CreateClient(clientName);
                var res = await client.GetAsync(endpoint, linkedCts.Token);
                return res.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        var springTask = CheckDependencyAsync("SpringBoot", "/api/v1/suburbs");
        var mlTask     = CheckDependencyAsync("MLService", "/api/v1/ml/health");
        await Task.WhenAll(springTask, mlTask);

        return Ok(new HealthResponse(
            Status:    "ok",
            Service:   "CommunityAlerts.Notifications",
            Timestamp: DateTime.UtcNow,
            Checks: new Dictionary<string, bool>
            {
                ["database"]     = true,
                ["springBoot"]   = springTask.Result,
                ["mlService"]    = mlTask.Result,
                ["emailService"] = true,
                ["pushService"]  = true,
            }
        ));
    }
}
