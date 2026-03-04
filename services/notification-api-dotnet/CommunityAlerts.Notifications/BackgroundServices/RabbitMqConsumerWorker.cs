using CommunityAlerts.Notifications.DTOs;
using CommunityAlerts.Notifications.Services;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;

namespace CommunityAlerts.Notifications.BackgroundServices;

/// <summary>
/// Consumes suburb alert events from RabbitMQ — the reliable replacement
/// for the old HTTP webhook pattern.
///
/// When the Java API detects a suburb escalation (ORANGE/RED), it publishes
/// a JSON event to the "suburb-alerts" queue.  This worker picks it up
/// and dispatches notifications via INotificationService.
///
/// The SuburbPollingWorker and WebhookController remain as fallbacks
/// for resilience — defence in depth.
/// </summary>
public class RabbitMqConsumerWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scope;
    private readonly ILogger<RabbitMqConsumerWorker> _logger;
    private readonly IConfiguration _config;

    private IConnection? _connection;
    private IModel? _channel;

    public RabbitMqConsumerWorker(
        IServiceScopeFactory scope,
        ILogger<RabbitMqConsumerWorker> logger,
        IConfiguration config)
    {
        _scope  = scope;
        _logger = logger;
        _config = config;
    }

    protected override Task ExecuteAsync(CancellationToken ct)
    {
        ct.Register(Dispose);

        try
        {
            var factory = new ConnectionFactory
            {
                HostName = _config["RabbitMQ:Host"] ?? "localhost",
                Port     = int.Parse(_config["RabbitMQ:Port"] ?? "5672"),
                UserName = _config["RabbitMQ:Username"] ?? "guest",
                Password = _config["RabbitMQ:Password"] ?? "guest",
            };

            _connection = factory.CreateConnection();
            _channel    = _connection.CreateModel();

            // Ensure queue exists (idempotent — matches Java-side declaration)
            _channel.QueueDeclare(
                queue: "suburb-alerts",
                durable: true,
                exclusive: false,
                autoDelete: false,
                arguments: null);

            _channel.BasicQos(prefetchSize: 0, prefetchCount: 1, global: false);

            var consumer = new EventingBasicConsumer(_channel);
            consumer.Received += async (_, ea) =>
            {
                try
                {
                    var body    = Encoding.UTF8.GetString(ea.Body.ToArray());
                    var payload = JsonSerializer.Deserialize<SuburbAlertEvent>(
                        body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                    if (payload is null)
                    {
                        _logger.LogWarning("Received null or unparsable RabbitMQ message");
                        _channel.BasicAck(ea.DeliveryTag, false);
                        return;
                    }

                    _logger.LogInformation(
                        "RabbitMQ alert received → suburb={Suburb} level={Level}",
                        payload.SuburbName, payload.AlertLevel);

                    using var scope = _scope.CreateScope();
                    var notifications = scope.ServiceProvider
                        .GetRequiredService<INotificationService>();

                    var request = new SuburbAlertWebhookRequest(
                        SuburbId:           payload.SuburbId,
                        SuburbName:         payload.SuburbName,
                        HeatScore:          payload.HeatScore,
                        AlertLevel:         payload.AlertLevel,
                        PreviousAlertLevel: "UNKNOWN",  // queue events don't carry previous
                        IncidentCount:      0,
                        TriggeredAt:        DateTime.UtcNow);

                    await notifications.ProcessAlertAsync(request, ct);

                    _channel.BasicAck(ea.DeliveryTag, false);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing RabbitMQ suburb alert");
                    // Negative-ack and requeue so the message isn't lost
                    _channel.BasicNack(ea.DeliveryTag, false, true);
                }
            };

            _channel.BasicConsume(
                queue: "suburb-alerts",
                autoAck: false,
                consumer: consumer);

            _logger.LogInformation("RabbitMQ consumer started — listening on queue 'suburb-alerts'");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start RabbitMQ consumer. Falling back to polling.");
        }

        return Task.CompletedTask;
    }

    public override void Dispose()
    {
        _channel?.Close();
        _connection?.Close();
        base.Dispose();
    }

    /// <summary>Event shape matching the Java-side SuburbAlertPublisher output.</summary>
    private record SuburbAlertEvent(
        string SuburbId,
        string SuburbName,
        int HeatScore,
        string AlertLevel,
        string TriggeredAt);
}
