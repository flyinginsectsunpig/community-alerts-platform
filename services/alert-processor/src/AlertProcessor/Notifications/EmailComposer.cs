using System.Globalization;

namespace AlertProcessor.Notifications;

/// <summary>
/// Shared text helpers for notification copy. The per-alert zone-match and
/// escalation email templates were retired when delivery moved to browser
/// push (account digests are the remaining email surface).
/// </summary>
public static class EmailComposer
{
    internal static string Humanize(string category) =>
        category.Replace('_', ' ').ToLowerInvariant();

    internal static string FormatDistance(double meters) =>
        meters < 1000
            ? string.Create(CultureInfo.InvariantCulture, $"{Math.Round(meters)} m")
            : string.Create(CultureInfo.InvariantCulture, $"{meters / 1000.0:0.0} km");
}
