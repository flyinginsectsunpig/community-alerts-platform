using CommunityAlerts.Notifications.DTOs;
using CommunityAlerts.Notifications.Models;

namespace CommunityAlerts.Notifications.Services;

/// <summary>
/// Builds email and push notification content from alert data.
/// Separated from NotificationService (SRP) so that templates
/// can be changed independently of dispatch logic.
/// </summary>
public static class EmailTemplateBuilder
{
    public static (string subject, string html) BuildEmailContent(
        SuburbAlertWebhookRequest alert,
        AlertLevel level)
    {
        string emoji      = level.ToEmoji();
        string levelColor = level switch
        {
            AlertLevel.Red    => "#ef4444",
            AlertLevel.Orange => "#f97316",
            AlertLevel.Yellow => "#eab308",
            _                 => "#22c55e",
        };

        string subject = $"{emoji} Community Alert: {alert.SuburbName} has reached {alert.AlertLevel} status";

        string html = $"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="margin:0;padding:0;background:#0a0c10;font-family:sans-serif">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:40px 20px">
                    <table width="560" cellpadding="0" cellspacing="0"
                           style="background:#111318;border-radius:12px;border:1px solid #252832;overflow:hidden">

                      <!-- Header -->
                      <tr>
                        <td style="background:{levelColor}22;border-bottom:2px solid {levelColor};
                                   padding:24px 32px">
                          <div style="font-size:32px;margin-bottom:8px">{emoji}</div>
                          <div style="color:{levelColor};font-size:12px;font-weight:700;
                                      letter-spacing:2px;text-transform:uppercase;
                                      font-family:monospace">
                            {alert.AlertLevel} ALERT
                          </div>
                          <div style="color:#e8eaf0;font-size:22px;font-weight:700;margin-top:4px">
                            {alert.SuburbName}
                          </div>
                        </td>
                      </tr>

                      <!-- Body -->
                      <tr>
                        <td style="padding:24px 32px">
                          <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 20px">
                            The Community Alerts heat score for
                            <strong style="color:#e8eaf0">{alert.SuburbName}</strong>
                            has reached <strong style="color:{levelColor}">{alert.AlertLevel}</strong>
                            (score: {alert.HeatScore}).
                            There are currently <strong style="color:#e8eaf0">{alert.IncidentCount} active incidents</strong>
                            in this area.
                          </p>

                          <table width="100%" cellpadding="0" cellspacing="0"
                                 style="background:#191c24;border-radius:8px;border:1px solid #252832">
                            <tr>
                              <td style="padding:12px 16px;border-bottom:1px solid #252832">
                                <span style="color:#6b7280;font-size:11px;font-family:monospace">HEAT SCORE</span><br>
                                <span style="color:{levelColor};font-size:24px;font-weight:700">{alert.HeatScore}</span>
                              </td>
                              <td style="padding:12px 16px;border-bottom:1px solid #252832">
                                <span style="color:#6b7280;font-size:11px;font-family:monospace">PREVIOUS LEVEL</span><br>
                                <span style="color:#e8eaf0;font-size:16px;font-weight:600">{alert.PreviousAlertLevel}</span>
                              </td>
                              <td style="padding:12px 16px;border-bottom:1px solid #252832">
                                <span style="color:#6b7280;font-size:11px;font-family:monospace">ACTIVE INCIDENTS</span><br>
                                <span style="color:#e8eaf0;font-size:16px;font-weight:600">{alert.IncidentCount}</span>
                              </td>
                            </tr>
                          </table>

                          <div style="margin-top:24px">
                            <a href="https://communityalerts.co.za/map?suburb={alert.SuburbId}"
                               style="display:inline-block;background:{levelColor};color:#fff;
                                      text-decoration:none;padding:12px 24px;border-radius:8px;
                                      font-weight:700;font-size:14px">
                              View on Map →
                            </a>
                          </div>
                        </td>
                      </tr>

                      <!-- Footer -->
                      <tr>
                        <td style="padding:16px 32px;border-top:1px solid #252832">
                          <p style="color:#4b5563;font-size:11px;font-family:monospace;margin:0">
                            Community Alerts · Cape Town ·
                            <a href="https://communityalerts.co.za/unsubscribe"
                               style="color:#6b7280">Unsubscribe</a>
                          </p>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """;

        return (subject, html);
    }

    public static string BuildPushBody(SuburbAlertWebhookRequest alert) =>
        $"Heat score: {alert.HeatScore} · {alert.IncidentCount} active incidents. Tap to view the map.";
}
