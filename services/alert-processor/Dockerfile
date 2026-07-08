# ---- Build stage ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /workspace
COPY src/AlertProcessor/AlertProcessor.csproj src/AlertProcessor/
RUN dotnet restore src/AlertProcessor/AlertProcessor.csproj
COPY src ./src
RUN dotnet publish src/AlertProcessor/AlertProcessor.csproj -c Release -o /app --no-restore

# ---- Runtime stage ----
FROM mcr.microsoft.com/dotnet/runtime:8.0
RUN useradd --system --uid 1001 appuser
WORKDIR /app
COPY --from=build /app .
USER appuser
ENTRYPOINT ["dotnet", "AlertProcessor.dll"]
