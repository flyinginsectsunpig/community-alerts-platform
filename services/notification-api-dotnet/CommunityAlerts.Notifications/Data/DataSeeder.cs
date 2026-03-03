using CommunityAlerts.Notifications.Data;
using CommunityAlerts.Notifications.Models;
using Microsoft.EntityFrameworkCore;

namespace CommunityAlerts.Notifications.Data;

/// <summary>
/// Seeds demo subscribers and subscriptions on startup in development.
/// </summary>
public static class DataSeeder
{
    public static async Task SeedAsync(NotificationDbContext db)
    {
        await db.Database.EnsureCreatedAsync();

        try
        {
            if (await db.Subscribers.AnyAsync()) return;
        }
        catch (Exception ex) when (ex.Message.Contains("no such table", StringComparison.OrdinalIgnoreCase))
        {
            // Recover from a partially created local DB file.
            await db.Database.EnsureDeletedAsync();
            await db.Database.EnsureCreatedAsync();
        }

        var subscribers = new List<Subscriber>
        {
            new() {
                Email    = "naomi.k@communityalerts.co.za",
                Username = "NaomiK",
                IsActive = true,
                Subscriptions = new List<SuburbSubscription>
                {
                    new() { SuburbId = "khaye", SuburbName = "Khayelitsha",
                            MinimumAlertLevel = AlertLevel.Orange,
                            NotifyByEmail = true, NotifyByPush = false },
                    new() { SuburbId = "mitch", SuburbName = "Mitchells Plain",
                            MinimumAlertLevel = AlertLevel.Red,
                            NotifyByEmail = true, NotifyByPush = false },
                }
            },
            new() {
                Email    = "david.f@communityalerts.co.za",
                Username = "DavidF",
                IsActive = true,
                Subscriptions = new List<SuburbSubscription>
                {
                    new() { SuburbId = "grassy", SuburbName = "Grassy Park",
                            MinimumAlertLevel = AlertLevel.Yellow,
                            NotifyByEmail = true, NotifyByPush = true },
                }
            },
            new() {
                Email    = "rasheeda.n@communityalerts.co.za",
                Username = "RasheedaN",
                IsActive = true,
                Subscriptions = new List<SuburbSubscription>
                {
                    new() { SuburbId = "mitch", SuburbName = "Mitchells Plain",
                            MinimumAlertLevel = AlertLevel.Orange,
                            NotifyByEmail = true, NotifyByPush = false },
                    new() { SuburbId = "athlone", SuburbName = "Athlone",
                            MinimumAlertLevel = AlertLevel.Orange,
                            NotifyByEmail = true, NotifyByPush = false },
                }
            },
        };

        db.Subscribers.AddRange(subscribers);
        await db.SaveChangesAsync();
    }
}
