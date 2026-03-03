using CommunityAlerts.Notifications.Models;
using Microsoft.EntityFrameworkCore;

namespace CommunityAlerts.Notifications.Data;

/// <summary>
/// EF Core DbContext for the notification service.
/// Uses SQLite in development; swap the connection string for
/// SQL Server or PostgreSQL in production via appsettings.
/// </summary>
public class NotificationDbContext : DbContext
{
    public NotificationDbContext(DbContextOptions<NotificationDbContext> options)
        : base(options) { }

    public DbSet<Subscriber>          Subscribers   => Set<Subscriber>();
    public DbSet<SuburbSubscription>  Subscriptions => Set<SuburbSubscription>();
    public DbSet<NotificationLog>     Logs          => Set<NotificationLog>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        // Subscriber
        builder.Entity<Subscriber>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Email).HasMaxLength(256).IsRequired();
            e.Property(x => x.Username).HasMaxLength(50).IsRequired();
            e.Property(x => x.PushToken).HasMaxLength(512);
        });

        // SuburbSubscription
        builder.Entity<SuburbSubscription>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.SubscriberId, x.SuburbId }).IsUnique();
            e.Property(x => x.SuburbId).HasMaxLength(50).IsRequired();
            e.Property(x => x.SuburbName).HasMaxLength(100).IsRequired();
            e.HasOne(x => x.Subscriber)
             .WithMany(x => x.Subscriptions)
             .HasForeignKey(x => x.SubscriberId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // NotificationLog
        builder.Entity<NotificationLog>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.SubscriberId);
            e.HasIndex(x => x.SuburbId);
            e.HasIndex(x => x.SentAt);
            e.Property(x => x.Channel).HasMaxLength(20).IsRequired();
            e.Property(x => x.AlertLevel).HasMaxLength(20).IsRequired();
            e.Property(x => x.Subject).HasMaxLength(300).IsRequired();
            e.Property(x => x.Body).HasMaxLength(4000).IsRequired();
            e.Property(x => x.ErrorMessage).HasMaxLength(1000);
        });
    }
}
