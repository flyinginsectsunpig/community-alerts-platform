# Community Alerts — Spring Boot Backend

Real-time REST API for the Community Alerts platform.  
Built with **Java 21 · Spring Boot 3.4 · JPA · H2 (dev) / PostgreSQL (prod)**

---

## Architecture

```
Controller → Service (Interface) → ServiceImpl → Repository → Database
                      ↓
              HeatScoreService  ← called on every new incident
```

**Domain objects:**
- `Suburb` — Cape Town suburb with a live heat score
- `Incident` — A community-reported map ping (crime, accident, fire, etc.)
- `Comment` — A community sighting or update on an incident
- `ForumPost` — A suburb-specific discussion post

---

## Heat Score Algorithm

The suburb colour system (GREEN → YELLOW → ORANGE → RED) is powered by `HeatScoreService`.

For each incident in the last 30 days:
```
score += typeWeight × severity × recencyFactor
```

| Factor | Value |
|---|---|
| Type weight — CRIME | 5 |
| Type weight — FIRE | 4 |
| Type weight — SUSPICIOUS | 3 |
| Type weight — ACCIDENT | 2 |
| Type weight — POWER / INFO | 1 |
| Recency ≤ 7 days | × 1.0 |
| Recency 7–30 days | × 0.5 |

| Score | Alert Level |
|---|---|
| < 12 | 🟢 GREEN |
| 12–19 | 🟡 YELLOW |
| 20–29 | 🟠 ORANGE |
| ≥ 30 | 🔴 RED |

The Python ML service (Stage 3) will extend this with a trained regression model for *predictive* scoring.

---

## Running Locally

```bash
# Requires Java 21 + Maven
cd community-alerts-platform/services/java-api
mvn spring-boot:run
```

API available at `http://localhost:8080`  
Swagger UI at `http://localhost:8080/swagger-ui.html`  
H2 Console at `http://localhost:8080/h2-console`

---

## API Endpoints

### Incidents
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/incidents` | Report a new incident |
| `GET` | `/api/v1/incidents` | List all (paginated) |
| `GET` | `/api/v1/incidents/{id}` | Get by ID |
| `GET` | `/api/v1/incidents/suburb/{suburbId}` | Filter by suburb |
| `GET` | `/api/v1/incidents/type/{type}` | Filter by type |
| `GET` | `/api/v1/incidents/nearby?lat=&lng=&radiusKm=` | Radius search |
| `DELETE` | `/api/v1/incidents/{id}` | Remove incident |

### Suburbs
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/suburbs` | All suburbs with heat scores |
| `GET` | `/api/v1/suburbs/{id}` | Single suburb |
| `POST` | `/api/v1/suburbs/{id}/refresh-heat` | Force heat recalculation |

### Comments
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/incidents/{id}/comments` | Add comment |
| `GET` | `/api/v1/incidents/{id}/comments` | Get comments |

### Forum
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/forum/suburbs/{id}/posts` | Create post |
| `GET` | `/api/v1/forum/suburbs/{id}/posts` | Get posts |
| `POST` | `/api/v1/forum/posts/{id}/like` | Like a post |

---

## Docker

```bash
docker build -t community-alerts-backend .
docker run -p 8080:8080 community-alerts-backend
```

---

## Production Notes

- Swap H2 for **PostgreSQL** with PostGIS for proper geospatial queries
- Replace in-memory rate limiter with **Redis + Bucket4j**
- Add **Spring Security + JWT** for authenticated reporters
- Use **WebSockets** for real-time incident push to the frontend
