using AlertProcessor;
using AlertProcessor.Caching;
using AlertProcessor.Data;
using AlertProcessor.Messaging;
using AlertProcessor.Notifications;
using AlertProcessor.Processing;
using Npgsql;
using StackExchange.Redis;

var builder = Host.CreateApplicationBuilder(args);

var options = WorkerOptions.FromEnvironment();
builder.Services.AddSingleton(options);

builder.Services.AddSingleton(_ => NpgsqlDataSource.Create(options.PostgresConnectionString));
builder.Services.AddSingleton<IConnectionMultiplexer>(
    _ => ConnectionMultiplexer.Connect(options.RedisConfiguration));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton(new HttpClient { Timeout = TimeSpan.FromSeconds(10) });

builder.Services.AddSingleton<IWatchZoneRepository, PostgresWatchZoneRepository>();
builder.Services.AddSingleton<INotificationRepository, PostgresNotificationRepository>();
builder.Services.AddSingleton<IStatsRepository, PostgresStatsRepository>();
builder.Services.AddSingleton<IAlertExpiryRepository, PostgresAlertExpiryRepository>();
builder.Services.AddSingleton<IPushSubscriptionRepository, PostgresPushSubscriptionRepository>();
builder.Services.AddSingleton<IDigestRepository, PostgresDigestRepository>();
builder.Services.AddSingleton<ISnapshotCache, RedisSnapshotCache>();

builder.Services.AddSingleton<IEmailSender, ResendEmailSender>();
builder.Services.AddSingleton<IPushSender, WebPushSender>();
builder.Services.AddSingleton<WatchZoneMatcher>();
builder.Services.AddSingleton<StatsAggregator>();
builder.Services.AddSingleton<NotificationDispatcher>();
builder.Services.AddSingleton<AlertEnrichmentHandler>();
builder.Services.AddSingleton<EscalationHandler>();

builder.Services.AddHostedService<RabbitConsumerService>();
builder.Services.AddHostedService<ExpirySweepService>();
builder.Services.AddHostedService<DigestService>();

await builder.Build().RunAsync();
