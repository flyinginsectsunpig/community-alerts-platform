namespace CommunityAlerts.Notifications.Models;

public enum AlertLevel
{
    Green  = 0,
    Yellow = 1,
    Orange = 2,
    Red    = 3
}

public static class AlertLevelExtensions
{
    public static AlertLevel Parse(string level) => level.ToUpperInvariant() switch
    {
        "GREEN"  => AlertLevel.Green,
        "YELLOW" => AlertLevel.Yellow,
        "ORANGE" => AlertLevel.Orange,
        "RED"    => AlertLevel.Red,
        _        => AlertLevel.Orange
    };

    public static string ToEmoji(this AlertLevel level) => level switch
    {
        AlertLevel.Green  => "🟢",
        AlertLevel.Yellow => "🟡",
        AlertLevel.Orange => "🟠",
        AlertLevel.Red    => "🔴",
        _                 => "⚪"
    };
}
