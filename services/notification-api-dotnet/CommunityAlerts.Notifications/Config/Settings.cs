namespace CommunityAlerts.Notifications.Config;

public class EmailSettings
{
    public string Mode        { get; set; } = "Log";   // "Log" | "Send"
    public string Host        { get; set; } = "smtp.gmail.com";
    public int    Port        { get; set; } = 587;
    public string Username    { get; set; } = string.Empty;
    public string Password    { get; set; } = string.Empty;
    public string FromAddress { get; set; } = "alerts@communityalerts.co.za";
    public string FromName    { get; set; } = "Community Alerts";
}

public class ServiceUrls
{
    public string SpringBoot { get; set; } = "http://localhost:8080";
    public string MLService  { get; set; } = "http://localhost:8001";
}
