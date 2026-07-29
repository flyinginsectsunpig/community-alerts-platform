using WebPush;

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
    public string? VapidPublicKey { get; init; }
    public string? VapidPrivateKey { get; init; }
    public string? VapidSubject { get; init; }

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
            VapidPublicKey = Optional("VAPID_PUBLIC_KEY"),
            VapidPrivateKey = Optional("VAPID_PRIVATE_KEY"),
            VapidSubject = Optional("VAPID_SUBJECT"),
        };
    }

    /// <summary>
    /// Push may be left entirely unconfigured, but a half-configured or
    /// malformed set is always a mistake — and one that hides itself, because
    /// WebPushSender quietly disables sending when a value is missing and
    /// swallows the per-send exception when one is malformed. Both states ran
    /// unnoticed in production, so the worker refuses to start on either.
    /// </summary>
    public void ValidatePushConfiguration()
    {
        var present = new[] { VapidPublicKey, VapidPrivateKey, VapidSubject }
            .Count(value => !string.IsNullOrWhiteSpace(value));
        if (present == 0)
        {
            return; // Push is switched off deliberately.
        }

        if (present < 3)
        {
            throw new InvalidOperationException(
                "Incomplete push configuration: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and " +
                "VAPID_SUBJECT must all be set, or all be left unset to disable push.");
        }

        try
        {
            // Generating headers is exactly what each send does, so anything the
            // library will reject at delivery time is rejected here instead.
            VapidHelper.GetVapidHeaders(
                "https://example.com", VapidSubject, VapidPublicKey, VapidPrivateKey);
        }
        catch (Exception ex)
        {
            var culprit = IsUsableSubject(VapidSubject) ? "VAPID keys are" : "VAPID_SUBJECT is";
            throw new InvalidOperationException(
                $"Push is configured but the {culprit} not usable: {ex.Message}", ex);
        }
    }

    /// <summary>Mirrors the library's rule: a mailto: address or an http(s) URL.</summary>
    private static bool IsUsableSubject(string? subject) =>
        subject is not null
        && (subject.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase)
            || Uri.TryCreate(subject, UriKind.Absolute, out var uri)
               && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps));

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
