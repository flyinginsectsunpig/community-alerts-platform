using System.Net;
using AlertProcessor.Domain;

namespace AlertProcessor.Notifications;

/// <summary>
/// Pure email content assembly. All user-generated text (descriptions, zone
/// names) is HTML-encoded — reports are untrusted input.
/// </summary>
public static class EmailComposer
{
    public static (string Subject, string Html) ZoneMatch(AlertCreatedEvent alert, ZoneMatch match)
    {
        var category = Humanize(alert.Category);
        var distance = FormatDistance(match.DistanceMeters);
        var subject = $"New {category} report {distance} from '{match.Zone.Name}'";
        var html = $"""
            <h2>New {category} report near your watch zone</h2>
            <p><strong>{WebUtility.HtmlEncode(match.Zone.Name)}</strong> &mdash; {distance} away.</p>
            <blockquote style="border-left:3px solid #ccc;margin:8px 0;padding:4px 12px;">
            {WebUtility.HtmlEncode(alert.Description)}
            </blockquote>
            <p>Reported at {alert.CreatedAt:yyyy-MM-dd HH:mm} UTC. Open the Community Alerts dashboard to view and confirm.</p>
            """;
        return (subject, html);
    }

    public static (string Subject, string Html) Escalation(AlertScoredEvent alert, ZoneMatch match)
    {
        var category = Humanize(alert.Category);
        var distance = FormatDistance(match.DistanceMeters);
        var subject = $"{alert.Severity} alert: {category} {distance} from '{match.Zone.Name}'";
        var html = $"""
            <h2>{alert.Severity} severity alert near your watch zone</h2>
            <p><strong>{WebUtility.HtmlEncode(match.Zone.Name)}</strong> &mdash; {distance} away
            (risk score {alert.RiskScore:0.00}).</p>
            <p>This alert was escalated to a widened area because of its assessed danger.
            Please stay clear of the location and follow local guidance.</p>
            """;
        return (subject, html);
    }

    internal static string Humanize(string category) =>
        category.Replace('_', ' ').ToLowerInvariant();

    internal static string FormatDistance(double meters) =>
        meters < 1000 ? $"{Math.Round(meters)} m" : $"{meters / 1000.0:0.0} km";
}
