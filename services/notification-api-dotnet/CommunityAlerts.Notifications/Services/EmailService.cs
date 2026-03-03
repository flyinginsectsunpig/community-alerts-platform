using CommunityAlerts.Notifications.Config;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Microsoft.Extensions.Options;

namespace CommunityAlerts.Notifications.Services;

/// <summary>
/// Production-ready email dispatch via MailKit + SMTP.
///
/// In development, SmtpMode = "Log" simply logs the email to the console
/// so the service can run without a real SMTP server.
/// Set SmtpMode = "Send" and provide SMTP credentials via environment
/// variables or user secrets in production.
/// </summary>
public class EmailService : IEmailService
{
    private readonly EmailSettings   _settings;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IOptions<EmailSettings> settings, ILogger<EmailService> logger)
    {
        _settings = settings.Value;
        _logger   = logger;
    }

    public async Task<bool> SendAsync(
        string to,
        string subject,
        string htmlBody,
        CancellationToken ct = default)
    {
        if (_settings.Mode == "Log")
        {
            // Development mode — log instead of sending
            _logger.LogInformation(
                "[EMAIL SIMULATION] To={To} | Subject={Subject} | Body={Body}",
                to, subject, htmlBody.Length > 200 ? htmlBody[..200] + "…" : htmlBody);
            return true;
        }

        try
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_settings.FromName, _settings.FromAddress));
            message.To.Add(MailboxAddress.Parse(to));
            message.Subject = subject;

            message.Body = new BodyBuilder { HtmlBody = htmlBody }.ToMessageBody();

            using var client = new SmtpClient();
            await client.ConnectAsync(_settings.Host, _settings.Port, SecureSocketOptions.StartTls, ct);
            await client.AuthenticateAsync(_settings.Username, _settings.Password, ct);
            await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);

            _logger.LogInformation("Email sent successfully to {To}", to);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {To}", to);
            return false;
        }
    }
}
