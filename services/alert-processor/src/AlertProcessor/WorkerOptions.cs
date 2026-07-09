namespace AlertProcessor;

/// <summary>
/// All configuration is sourced from runtime environment variables; the
/// process refuses to start if a required value is missing (fail fast).
/// </summary>
public sealed record WorkerOptions
{
    public required string PostgresConnectionString { get; init; }
    public required string RedisConfiguration { get; init; }
    public required string RabbitHost { get; init; }
    public required int RabbitPort { get; init; }
    public required string RabbitUser { get; init; }
    public required string RabbitPassword { get; init; }
    public required string RabbitVhost { get; init; }
    public required bool RabbitSsl { get; init; }
    public string? NotificationWebhookUrl { get; init; }
    public string? ResendApiKey { get; init; }
    public string EmailFrom { get; init; } = DefaultEmailFrom;

    /// <summary>Resend sandbox sender; verified-domain senders go in EMAIL_FROM.</summary>
    public const string DefaultEmailFrom = "Community Alerts <onboarding@resend.dev>";

    public static WorkerOptions FromEnvironment()
    {
        var redisHost = Require("REDIS_HOST");
        var redisPort = Require("REDIS_PORT");
        var redisPassword = Require("REDIS_PASSWORD");
        var redisSsl = ReadBool("REDIS_SSL", defaultValue: true);

        return new WorkerOptions
        {
            PostgresConnectionString = Require("POSTGRES_CONNECTION_STRING"),
            RedisConfiguration =
                $"{redisHost}:{redisPort},password={redisPassword},ssl={redisSsl.ToString().ToLowerInvariant()}," +
                "abortConnect=false,connectTimeout=10000",
            RabbitHost = Require("RABBITMQ_HOST"),
            RabbitPort = int.Parse(Require("RABBITMQ_PORT")),
            RabbitUser = Require("RABBITMQ_USERNAME"),
            RabbitPassword = Require("RABBITMQ_PASSWORD"),
            RabbitVhost = Require("RABBITMQ_VHOST"),
            RabbitSsl = ReadBool("RABBITMQ_SSL", defaultValue: true),
            NotificationWebhookUrl = Optional("NOTIFICATION_WEBHOOK_URL"),
            ResendApiKey = Optional("RESEND_API_KEY"),
            EmailFrom = Optional("EMAIL_FROM") ?? DefaultEmailFrom,
        };
    }

    private static string Require(string name) =>
        Environment.GetEnvironmentVariable(name) is { Length: > 0 } value
            ? value
            : throw new InvalidOperationException($"Missing required environment variable: {name}");

    private static string? Optional(string name) =>
        Environment.GetEnvironmentVariable(name) is { Length: > 0 } value ? value : null;

    private static bool ReadBool(string name, bool defaultValue) =>
        Environment.GetEnvironmentVariable(name) is { Length: > 0 } value
            ? bool.Parse(value)
            : defaultValue;
}
