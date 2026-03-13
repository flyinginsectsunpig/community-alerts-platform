using CommunityAlerts.Notifications.BackgroundServices;
using CommunityAlerts.Notifications.Config;
using CommunityAlerts.Notifications.Data;
using CommunityAlerts.Notifications.DTOs;
using CommunityAlerts.Notifications.Services;
using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Port is configured via ASPNETCORE_URLS environment variable (80 in production, 5001 locally)

// ── Serilog ───────────────────────────────────────────────────────────────────
builder.Host.UseSerilog((ctx, config) =>
    config.ReadFrom.Configuration(ctx.Configuration)
          .WriteTo.Console(outputTemplate:
            "[{Timestamp:HH:mm:ss} {Level:u3}] {SourceContext} | {Message:lj}{NewLine}{Exception}"));

// ── Configuration ─────────────────────────────────────────────────────────────
builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("Email"));
builder.Services.Configure<ServiceUrls>(builder.Configuration.GetSection("ServiceUrls"));

// ── Database ──────────────────────────────────────────────────────────────────
var dbProvider = builder.Configuration["DatabaseProvider"]?.Trim().ToLowerInvariant() ?? "sqlite";
var connectionString = builder.Configuration.GetConnectionString("Default");

builder.Services.AddDbContext<NotificationDbContext>(options =>
{
    if (dbProvider is "postgres" or "postgresql")
    {
        options.UseNpgsql(connectionString);
    }
    else
    {
        options.UseSqlite(connectionString);
    }
});

// ── HTTP Clients with resilience (Polly) ──────────────────────────────────────
var serviceUrls = builder.Configuration.GetSection("ServiceUrls").Get<ServiceUrls>()!;

builder.Services.AddHttpClient("SpringBoot", client =>
{
    client.BaseAddress = new Uri(serviceUrls.SpringBoot);
    client.Timeout     = TimeSpan.FromSeconds(10);
})
.AddStandardResilienceHandler();  // Polly retry + circuit breaker

builder.Services.AddHttpClient("MLService", client =>
{
    client.BaseAddress = new Uri(serviceUrls.MLService);
    client.Timeout     = TimeSpan.FromSeconds(15);
})
.AddStandardResilienceHandler();

// ── Services ──────────────────────────────────────────────────────────────────
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<ISubscriberService,   SubscriberService>();
builder.Services.AddScoped<IEmailService,        EmailService>();
builder.Services.AddScoped<IPushService,         PushService>();

// ── Validators (FluentValidation) ─────────────────────────────────────────────
builder.Services.AddScoped<IValidator<CreateSubscriberRequest>,   CreateSubscriberValidator>();
builder.Services.AddScoped<IValidator<CreateSubscriptionRequest>, CreateSubscriptionValidator>();

// ── Background workers ────────────────────────────────────────────────────────
builder.Services.AddHostedService<SuburbPollingWorker>();
builder.Services.AddHostedService<RabbitMqConsumerWorker>();

// ── API ───────────────────────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new()
    {
        Title       = "Community Alerts — Notification Service",
        Version     = "v1",
        Description = "Webhook-driven notification dispatch for the Community Alerts platform. "  +
                      "Handles suburb alert subscriptions, email and push delivery, "             +
                      "notification logging, and deduplication.",
    });
});

builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

var app = builder.Build();

// ── Migrate + seed ────────────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<NotificationDbContext>();
    await DataSeeder.SeedAsync(db);
}

// ── Middleware ────────────────────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Notification Service v1");
        c.RoutePrefix = "swagger";
    });
}

app.UseExceptionHandler(errApp => errApp.Run(async ctx =>
{
    var feature = ctx.Features.Get<IExceptionHandlerFeature>();
    var ex      = feature?.Error;

    var (status, title) = ex switch
    {
        KeyNotFoundException      => (404, "Not Found"),
        InvalidOperationException => (409, "Conflict"),
        _                         => (500, "An unexpected error occurred"),
    };

    ctx.Response.StatusCode  = status;
    ctx.Response.ContentType = "application/problem+json";

    await ctx.Response.WriteAsJsonAsync(new ProblemDetails
    {
        Status = status,
        Title  = title,
        Detail = ex?.Message,
    });
}));

app.UseSerilogRequestLogging();
app.UseCors();
app.MapControllers();

app.Logger.LogInformation("Community Alerts Notification Service starting on port 5001");
app.Run();