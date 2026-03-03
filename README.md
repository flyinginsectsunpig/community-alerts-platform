# Community Alerts Platform

Monorepo structure organized by responsibility and deployment boundary.

## Folder Layout

```text
community-alerts-platform/
  apps/
    web-map/                    # Frontend app (single-page map UI)
      index.html
      styles/
        main.css
      src/
        main.js                 # Composition root
        config/                 # Runtime config
        constants/              # Type + UI constants
        data/                   # Fallback seed data
        map/                    # Leaflet loader + map manager
        services/               # API client abstractions
        state/                  # App state
        ui/                     # Rendering functions
        utils/                  # Mapping/format helpers

  services/
    java-api/                   # Spring Boot incident + suburb heat API
    notification-api-dotnet/    # ASP.NET Core notification service
    ml-api-python/              # FastAPI ML inference service

  infra/
    docker/
      docker-compose.yml        # Multi-service orchestration

  archives/
    community-alerts-source.zip # Original exported bundle
```

## Why This Makes Sense (SOLID-oriented)

- Single Responsibility:
  - `apps/` contains UI only.
  - `services/` contains independently deployable backend domains.
  - `infra/` contains environment/runtime wiring only.
  - `archives/` keeps non-source artifacts out of active code paths.
- Open/Closed:
  - New services can be added under `services/` without changing existing service internals.
- Liskov + Interface Segregation:
  - Service contracts remain local to each bounded context (Java, .NET, ML) instead of being mixed in one folder.
- Dependency Inversion (repo-level):
  - Runtime dependencies are defined in `infra/docker/docker-compose.yml`; service code does not depend on repository layout details.

## Run

From `infra/docker`:

```bash
docker compose up --build
```

Then run the web app from the repo root (do not open `index.html` directly from disk):

```bash
python -m http.server 5173
```

Open:

`http://localhost:5173/apps/web-map/`

Backend API defaults used by the frontend:

- Java API: `http://localhost:8080`
- ML API: `http://localhost:8001`
- C# API: `http://localhost:5001`
