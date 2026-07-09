using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.Logging;

namespace AlertProcessor.Notifications;

public interface IEmailSender
{
    /// <summary>
    /// Best-effort delivery: implementations must never throw (except on
    /// cancellation) — a mail-provider outage must not dead-letter the
    /// message whose processing triggered the email.
    /// </summary>
    Task SendAsync(string to, string subject, string html, CancellationToken ct);
}

/// <summary>
/// Sends through Resend's REST API (https://resend.com/docs/api-reference).
/// Kept as a plain HttpClient call — no SDK dependency. When RESEND_API_KEY
/// is unset, delivery is skipped and the durable notification rows remain
/// the source of truth.
/// </summary>
public sealed class ResendEmailSender(
    HttpClient httpClient,
    WorkerOptions options,
    ILogger<ResendEmailSender> logger) : IEmailSender
{
    private const string Endpoint = "https://api.resend.com/emails";

    public async Task SendAsync(string to, string subject, string html, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(options.ResendApiKey))
        {
            logger.LogDebug("RESEND_API_KEY not set; skipping email '{Subject}' to {To}", subject, to);
            return;
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, Endpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.ResendApiKey);
            request.Content = JsonContent.Create(new
            {
                from = options.EmailFrom,
                to = new[] { to },
                subject,
                html,
            });

            using var response = await httpClient.SendAsync(request, ct);
            if (response.IsSuccessStatusCode)
            {
                logger.LogInformation("Email sent to {To}: {Subject}", to, subject);
            }
            else
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                logger.LogWarning("Resend rejected email to {To} with {Status}: {Body}",
                    to, (int)response.StatusCode, body);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Email delivery to {To} failed", to);
        }
    }
}
