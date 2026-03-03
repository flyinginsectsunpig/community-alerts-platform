# 🛡️ CommunityAlerts — Frontend Upgrade Guide

## What Changed

The frontend has been fully migrated from **plain HTML + vanilla JS** → **Next.js 14 + React + TypeScript** with a complete multi-page architecture.

---

## New Tech Stack

| Layer | Before | After |
|---|---|---|
| Framework | Vanilla HTML/JS | **Next.js 14 (App Router)** |
| UI | Manual DOM | **React 18 + TypeScript** |
| State | Scattered globals | **Zustand** (central store) |
| Styling | Single CSS file | **Tailwind CSS** + design system |
| Data fetching | Raw `fetch` calls | **TanStack Query** (caching + retries) |
| Charts | None | **Recharts** |
| Map | Leaflet CDN | **React-Leaflet** (SSR-safe) |
| Animations | Basic CSS | **CSS animations + Framer Motion** |
| Fonts | Google Fonts CDN | **Next.js Google Fonts** (optimized) |

---

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | **Dashboard** | Live stats, recent alerts feed, suburb heat index, quick actions |
| `/map` | **Live Map** | Leaflet map with filter pills, suburb heat circles, incident markers, detail panel |
| `/alerts` | **Alerts Feed** | Searchable/filterable card grid with sortable list + slide-in detail pane |
| `/analytics` | **Analytics** | Recharts: bar charts, pie chart, radar chart, suburb ranking grid |
| `/forum` | **Community Forum** | Suburb-tabbed forum boards with post/like/reply |
| `/suburb/[id]` | **Suburb Detail** | Per-suburb stats, incident chart, recent incidents, forum preview |

---

## Project Structure

```
src/
├── app/                     # Next.js App Router pages
│   ├── layout.tsx           # Root layout (Navbar, StatusBar, Providers)
│   ├── globals.css          # Design tokens, Tailwind, Leaflet overrides
│   ├── page.tsx             # Dashboard
│   ├── map/page.tsx         # Live Map
│   ├── alerts/page.tsx      # Alerts Feed
│   ├── analytics/page.tsx   # Analytics
│   ├── forum/page.tsx       # Forum
│   └── suburb/[id]/page.tsx # Suburb Detail (dynamic route)
│
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx        # Top navigation bar
│   │   ├── StatusBar.tsx     # Service status ticker
│   │   ├── Providers.tsx     # QueryClient + Bootstrap
│   │   └── BackendBootstrap.tsx  # Hydrates store from APIs
│   ├── map/
│   │   ├── MapView.tsx       # Map page layout + filter pills
│   │   └── LeafletMap.tsx    # Leaflet (client-only, dynamic import)
│   ├── alerts/
│   │   ├── AlertsFeed.tsx    # Alerts list + detail pane
│   │   └── ReportModal.tsx   # Report incident modal
│   ├── analytics/
│   │   └── AnalyticsPage.tsx # All charts and visualizations
│   ├── forum/
│   │   └── ForumPage.tsx     # Forum with suburb tabs
│   ├── DashboardPage.tsx     # Homepage
│   └── SuburbDetailPage.tsx  # Suburb detail
│
└── lib/
    ├── api/index.ts          # CommunityApi, MlApi, NotificationApi clients
    ├── store.ts              # Zustand global store
    ├── constants.ts          # TYPE_CONFIG, colors, defaults
    ├── types/index.ts        # All TypeScript interfaces
    └── data/fallback.ts      # Fallback suburbs, incidents, forum posts
```

---

## Setup Instructions

```bash
# 1. Navigate to the new frontend
cd apps/community-alerts-web   # or wherever you place this

# 2. Install dependencies
npm install

# 3. Set environment variables (copy and edit)
cp .env.example .env.local

# 4. Start development server
npm run dev
# → http://localhost:3000

# 5. Build for production
npm run build
npm start
```

---

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_JAVA_API_URL=http://localhost:8080
NEXT_PUBLIC_ML_API_URL=http://localhost:8001
NEXT_PUBLIC_NOTIF_API_URL=http://localhost:5000
```

---

## What's Next (Ideas for Your Magnum Opus)

### 🔒 Auth & Profiles
- Next-Auth with JWT from Java backend
- User profiles with report history
- Verified resident badges per suburb

### 🗺️ Map Enhancements
- Draw mode: polygon-based suburb boundaries (GeoJSON)
- Heatmap layer using Leaflet.heat
- Cluster markers for dense areas
- Street View integration

### 📱 PWA / Mobile
- `next-pwa` for offline support
- Push notification opt-in (hooks into your .NET notification API)
- Add to homescreen

### 🤖 ML Integration (your Python API)
- Show ML urgency classification on incident cards
- Pattern detection alerts in sidebar
- Risk forecast badges on suburbs

### 📊 Advanced Analytics
- Time-based charts (filter by date range)
- Heatmap calendar (GitHub-style) for incidents per day
- Correlation analysis: power outage vs crime spikes

### 🔔 Real-time
- WebSocket / SSE connection for live incident feed
- Toast notifications for new critical incidents
- Notification bell with unread count

### 🎨 Design Extras
- Dark/Light mode toggle
- Custom map tiles (Stamen Toner, Mapbox)
- Animated counter statistics
- Confetti/celebration for resolved incidents
