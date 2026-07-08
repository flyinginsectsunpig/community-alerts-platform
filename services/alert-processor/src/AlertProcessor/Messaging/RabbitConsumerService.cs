using System.Text.Json;
using AlertProcessor.Processing;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace AlertProcessor.Messaging;

/// <summary>
/// Long-running consumer against CloudAMQP LavinMQ (AMQPS). Declares the
/// shared topology idempotently and owns the two worker queues. Poison
/// messages are rejected without requeue and land in the dead-letter queue.
/// </summary>
public sealed class RabbitConsumerService(
    WorkerOptions options,
    AlertEnrichmentHandler enrichmentHandler,
    EscalationHandler escalationHandler,
    ILogger<RabbitConsumerService> logger) : BackgroundService
{
    private const string Exchange = "alerts.topic";
    private const string DeadLetterExchange = "alerts.dlx";
    private const string DeadLetterQueue = "q.dead-letter";
    private const string EnrichmentQueue = "q.worker.enrichment";
    private const string EscalationQueue = "q.worker.escalation";
    private const ushort PrefetchCount = 8;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var backoff = TimeSpan.FromSeconds(1);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunConnectionAsync(stoppingToken);
                backoff = TimeSpan.FromSeconds(1);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "AMQP connection failed; reconnecting in {Backoff}", backoff);
                try
                {
                    await Task.Delay(backoff, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                backoff = TimeSpan.FromSeconds(Math.Min(backoff.TotalSeconds * 2, 30));
            }
        }
    }

    private async Task RunConnectionAsync(CancellationToken stoppingToken)
    {
        var factory = new ConnectionFactory
        {
            HostName = options.RabbitHost,
            Port = options.RabbitPort,
            UserName = options.RabbitUser,
            Password = options.RabbitPassword,
            VirtualHost = options.RabbitVhost,
            Ssl = new SslOption { Enabled = options.RabbitSsl, ServerName = options.RabbitHost },
            DispatchConsumersAsync = true,
            AutomaticRecoveryEnabled = false, // the outer reconnect loop owns recovery
        };

        using var connection = factory.CreateConnection("alert-processor");
        using var channel = connection.CreateModel();

        DeclareTopology(channel);
        channel.BasicQos(prefetchSize: 0, prefetchCount: PrefetchCount, global: false);

        Consume<AlertCreatedEvent>(channel, EnrichmentQueue,
            (evt, ct) => enrichmentHandler.HandleAsync(evt, ct), stoppingToken);
        Consume<AlertScoredEvent>(channel, EscalationQueue,
            (evt, ct) => escalationHandler.HandleAsync(evt, ct), stoppingToken);

        logger.LogInformation("Consuming {Q1} and {Q2} on {Host}:{Port}/{Vhost}",
            EnrichmentQueue, EscalationQueue, options.RabbitHost, options.RabbitPort, options.RabbitVhost);

        var closed = new TaskCompletionSource();
        connection.ConnectionShutdown += (_, args) =>
            closed.TrySetException(new InvalidOperationException($"AMQP connection shut down: {args.ReplyText}"));
        await using var registration = stoppingToken.Register(() => closed.TrySetResult());

        await closed.Task;
    }

    private static void DeclareTopology(IModel channel)
    {
        channel.ExchangeDeclare(Exchange, ExchangeType.Topic, durable: true);
        channel.ExchangeDeclare(DeadLetterExchange, ExchangeType.Fanout, durable: true);
        channel.QueueDeclare(DeadLetterQueue, durable: true, exclusive: false, autoDelete: false);
        channel.QueueBind(DeadLetterQueue, DeadLetterExchange, routingKey: string.Empty);

        var queueArgs = new Dictionary<string, object> { ["x-dead-letter-exchange"] = DeadLetterExchange };
        channel.QueueDeclare(EnrichmentQueue, durable: true, exclusive: false, autoDelete: false, queueArgs);
        channel.QueueBind(EnrichmentQueue, Exchange, routingKey: "alert.created");
        channel.QueueDeclare(EscalationQueue, durable: true, exclusive: false, autoDelete: false, queueArgs);
        channel.QueueBind(EscalationQueue, Exchange, routingKey: "alert.scored");
    }

    private void Consume<TEvent>(
        IModel channel,
        string queue,
        Func<TEvent, CancellationToken, Task> handler,
        CancellationToken stoppingToken)
    {
        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.Received += async (_, ea) =>
        {
            try
            {
                var evt = JsonSerializer.Deserialize<TEvent>(ea.Body.Span, JsonDefaults.Options)
                          ?? throw new JsonException($"Empty {typeof(TEvent).Name} payload");
                await handler(evt, stoppingToken);
                channel.BasicAck(ea.DeliveryTag, multiple: false);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Shutting down: leave the message unacked for redelivery.
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to process message from {Queue}; dead-lettering", queue);
                channel.BasicNack(ea.DeliveryTag, multiple: false, requeue: false);
            }
        };

        channel.BasicConsume(queue, autoAck: false, consumer);
    }
}
