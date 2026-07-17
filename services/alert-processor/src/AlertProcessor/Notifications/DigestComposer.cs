using System.Net;
using System.Text;
using AlertProcessor.Domain;

namespace AlertProcessor.Notifications;

/// <summary>
/// Pure digest email assembly: one email per recipient summarizing their
/// zones' notifications for the period. All user-generated text (zone names,
/// messages built from report content) is HTML-encoded.
/// </summary>
public static class DigestComposer
{
    public static IReadOnlyList<(string Email, string Subject, string Html)> Compose(
        IReadOnlyList<DigestRow> rows, string periodLabel)
    {
        return rows
            .GroupBy(r => r.Email)
            .Select(recipient =>
            {
                var count = recipient.Count();
                var subject =
                    $"Community Alerts: {count} notification{(count == 1 ? "" : "s")} " +
                    $"in your zones this {periodLabel}";

                var html = new StringBuilder();
                html.Append($"<h2>Your watch zones this {WebUtility.HtmlEncode(periodLabel)}</h2>");
                foreach (var zone in recipient.GroupBy(r => r.ZoneName))
                {
                    html.Append($"<h3>{WebUtility.HtmlEncode(zone.Key)}</h3><ul>");
                    foreach (var row in zone)
                    {
                        html.Append(
                            $"<li>{WebUtility.HtmlEncode(row.Message)} " +
                            $"<small>({row.CreatedAt:yyyy-MM-dd HH:mm} UTC)</small></li>");
                    }
                    html.Append("</ul>");
                }
                html.Append("<p>Open the Community Alerts dashboard to manage your zones or this digest.</p>");

                return (recipient.Key, subject, html.ToString());
            })
            .ToList();
    }
}
