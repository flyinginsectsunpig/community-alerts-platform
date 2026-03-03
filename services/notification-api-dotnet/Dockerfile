# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src

COPY CommunityAlerts.Notifications/*.csproj ./CommunityAlerts.Notifications/
RUN dotnet restore CommunityAlerts.Notifications/CommunityAlerts.Notifications.csproj

COPY CommunityAlerts.Notifications/ ./CommunityAlerts.Notifications/
RUN dotnet publish CommunityAlerts.Notifications/CommunityAlerts.Notifications.csproj \
    -c Release -o /app/publish --no-restore

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine
WORKDIR /app

# Non-root user + writable directory for SQLite database
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && mkdir -p /data && chown appuser:appgroup /data
USER appuser

COPY --from=build /app/publish .

EXPOSE 5001

ENV ASPNETCORE_URLS=http://+:5001
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "CommunityAlerts.Notifications.dll"]