using System.Net;
using System.Text.Json;
using AlertProcessor.Notifications;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AlertProcessor.Tests;

public class ResendEmailSenderTests
{
    private static WorkerOptions Options(string? apiKey) => new()
    {
        PostgresConnectionString = "Host=unused",
        RedisConfiguration = "unused:6379",
        RabbitHost = "unused",
        RabbitPort = 5671,
        RabbitUser = "unused",
        RabbitPassword = "unused",
        RabbitVhost = "unused",
        RabbitSsl = true,
        ResendApiKey = apiKey,
        EmailFrom = "Community Alerts <onboarding@resend.dev>",
    };

    [Fact]
    public async Task SendsBearerAuthorizedJsonToResend()
    {
        var handler = new CapturingHandler(HttpStatusCode.OK);
        var sender = new ResendEmailSender(
            new HttpClient(handler), Options("re_test_key"), NullLogger<ResendEmailSender>.Instance);

        await sender.SendAsync("user@example.com", "Test subject", "<p>hi</p>", CancellationToken.None);

        Assert.NotNull(handler.LastRequest);
        Assert.Equal("https://api.resend.com/emails", handler.LastRequest!.RequestUri!.ToString());
        Assert.Equal("Bearer", handler.LastRequest.Headers.Authorization!.Scheme);
        Assert.Equal("re_test_key", handler.LastRequest.Headers.Authorization.Parameter);

        using var body = JsonDocument.Parse(handler.LastBody!);
        Assert.Equal("Community Alerts <onboarding@resend.dev>", body.RootElement.GetProperty("from").GetString());
        Assert.Equal("user@example.com", body.RootElement.GetProperty("to")[0].GetString());
        Assert.Equal("Test subject", body.RootElement.GetProperty("subject").GetString());
        Assert.Equal("<p>hi</p>", body.RootElement.GetProperty("html").GetString());
    }

    [Fact]
    public async Task SkipsDeliveryWhenApiKeyIsMissing()
    {
        var handler = new CapturingHandler(HttpStatusCode.OK);
        var sender = new ResendEmailSender(
            new HttpClient(handler), Options(null), NullLogger<ResendEmailSender>.Instance);

        await sender.SendAsync("user@example.com", "Subject", "<p>hi</p>", CancellationToken.None);

        Assert.Null(handler.LastRequest);
    }

    [Fact]
    public async Task ProviderRejectionsAndOutagesDoNotThrow()
    {
        var rejecting = new ResendEmailSender(
            new HttpClient(new CapturingHandler(HttpStatusCode.Forbidden)),
            Options("re_test_key"), NullLogger<ResendEmailSender>.Instance);
        await rejecting.SendAsync("user@example.com", "Subject", "<p>hi</p>", CancellationToken.None);

        var throwing = new ResendEmailSender(
            new HttpClient(new ThrowingHandler()),
            Options("re_test_key"), NullLogger<ResendEmailSender>.Instance);
        await throwing.SendAsync("user@example.com", "Subject", "<p>hi</p>", CancellationToken.None);
        // Reaching here without an exception is the assertion.
    }

    private sealed class CapturingHandler(HttpStatusCode status) : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }
        public string? LastBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            LastBody = request.Content is null
                ? null
                : await request.Content.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(status)
            {
                Content = new StringContent("{\"id\":\"email_test\"}"),
            };
        }
    }

    private sealed class ThrowingHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken) =>
            throw new HttpRequestException("network down");
    }
}
