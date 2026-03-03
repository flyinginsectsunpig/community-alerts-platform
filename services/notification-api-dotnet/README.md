# Community Alerts — C# Notification Service

ASP.NET Core 8 microservice handling alert subscriptions, email dispatch, and push notifications.  
**C# 12 · .NET 8 · Entity Framework Core · SQLite (dev) / SQL Server (prod)**

---

## Why a Separate Notification Service?

The Spring Boot backend is responsible for incident data and heat scoring.  
Notification dispatch is a separate concern with different scaling requirements:

- A RED alert in Khayelitsha might trigger 500 emails simultaneously
- Email sending is slow and can fail transiently — it must not block the incident API
- Notification preferences (which suburbs, which channels, which threshold) are user-specific state
- Audit logging and deduplication logic belongs here, not in the incident domain

This mirrors the pattern used in enterprise systems like the COGENT ABP Framework setup:
bounded contexts, each owning their domain.

---

## Architecture

```
Spring Boot ──→ POST /api/v1/notifications/webhook/suburb-alert
                          │
                          ▼
               NotificationService.ProcessAlertAsync()
                    │                │
                    ▼                ▼
              EmailService      PushService
              (MailKit SMTP)    (FCM stub)
                    │                │
                    └──────┬─────────┘
                           ▼
                   NotificationLog (EF Core)


SuburbPollingWorker (BackgroundService)
  └─ polls Spring Boot /api/v1/suburbs every 5 min
  └─ fires notifications for any RED suburb (safety net)
```

---

## Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/notifications/webhook/suburb-alert` | Inbound from Spring Boot |
| `POST` | `/api/v1/subscribers` | Register new subscriber |
| `GET`  | `/api/v1/subscribers/{id}` | Get subscriber + subscriptions |
| `GET`  | `/api/v1/subscribers` | List all subscribers |
| `POST` | `/api/v1/subscribers/{id}/subscriptions` | Subscribe to a suburb |
| `DELETE` | `/api/v1/subscribers/{id}/subscriptions/{subId}` | Unsubscribe |
| `GET`  | `/api/v1/subscribers/{id}/logs` | Notification history |
| `GET`  | `/api/v1/health` | Service + dependency health check |

Swagger UI: `http://localhost:5001/swagger`

---

## Key Design Decisions

**Deduplication** — If a suburb oscillates around the ORANGE/RED threshold, subscribers should not receive a flood of emails. The service checks `NotificationLog` for any notification sent in the last hour for the same suburb + alert level combination.

**Resilience** — HTTP clients to Spring Boot and the ML service use `AddStandardResilienceHandler()` (Polly): automatic retry with exponential backoff + circuit breaker. If Spring Boot goes down, this service queues retries rather than crashing.

**Background polling** — `SuburbPollingWorker` polls every 5 minutes as a safety net in case a webhook was missed. In production, replace with a message queue (RabbitMQ / Azure Service Bus) for guaranteed delivery.

**Email mode** — Set `Email:Mode = "Log"` in development. The service logs email content to the console without requiring SMTP credentials. Set to `"Send"` with real credentials in production.

---

## Running Locally

```bash
# Requires .NET 8 SDK
cd community-alerts-platform/services/notification-api-dotnet/CommunityAlerts.Notifications
dotnet run

# Service on http://localhost:5001
# Swagger at http://localhost:5001/swagger
```

---

## Docker

```bash
docker build -f Dockerfile -t community-alerts-csharp .
docker run -p 5001:5001 community-alerts-csharp
```

Full stack:
```bash
# From community-alerts-platform/infra/docker
docker compose up --build
```

---

## Connecting to Spring Boot

Add this to your Spring Boot `application.yml` to fire webhooks after heat score changes:

```yaml
app:
  notification-service:
    url: http://localhost:5001
    webhook-path: /api/v1/notifications/webhook/suburb-alert
```

Then call it from `HeatScoreService.recalculateForSuburb()` after a level transition.
