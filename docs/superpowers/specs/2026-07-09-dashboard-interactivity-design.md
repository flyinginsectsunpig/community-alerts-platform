# Dashboard interactivity & deployment — design

Date: 2026-07-09
Status: approved by user (interactive Q&A in session)
Scope: `apps/web` UI features; Azure deployment prep (separate phase, blocked on credentials)

## Context

The Community Alerts dashboard (Next.js 14 + react-leaflet, vanilla-CSS design
system in `apps/web/src/app/globals.css`) had a design-system pass earlier today
(commits 5ef60d9..d98fc71). This round adds interactivity. Design register:
impeccable "product" — motion conveys state, standard affordances, restrained
color. No new npm dependencies.

## Feature 1 — Collapsible sidebar

- Toggle button at the left of the topbar (inline SVG panel icon, `aria-expanded`,
  `aria-controls="sidebar"`), state `sidebarOpen` in `Dashboard` (default open).
- Desktop: `.sidebar` collapses via width transition (200ms ease) to 0 with
  `overflow: hidden`; map fills the freed space.
- Mobile (≤860px, column-reverse layout): the same state collapses the bottom
  sheet's height so the map is full-screen.
- Leaflet does not observe container resizes: add a `MapResize` helper inside
  `AlertMap` (`useMap` + `ResizeObserver` on the map container) calling
  `map.invalidateSize()` so tiles fill the space after collapse/expand.

## Feature 2 — Hotspot switch

Replace the bare checkbox with a switch built on a visually-hidden
`input[type=checkbox]` (native keyboard/AT semantics preserved): pill track
(~34×18px), sliding knob, `--accent` fill when checked, `:focus-visible` ring
on the track, 150ms knob transition. Label text stays "Hotspots".

## Feature 3 — State-driven motion pass

Approved principle: motion communicates state change; no decorative/scroll
choreography on an ops surface.

- New alerts arriving via SSE: feed item enters with a short slide-in and an
  accent-tinted background wash that fades over ~1.5s. Implementation: Dashboard
  tracks ids delivered by the live stream (`liveIds` set, pruned) and AlertFeed
  applies a `feed-item--new` class whose animation runs once.
- Stats: day bars grow with `transform: scaleY` (transform-origin bottom,
  ~300ms ease-out) on first data render; category bars get a width transition.
- Critical severity map markers receive a pulsing halo (Leaflet `className`
  path option + CSS keyframe on the SVG path).
- Skeleton → content: content fades in (~150ms).
- Everything inherits the existing global `prefers-reduced-motion` kill switch.

## Feature 4 — Floating map hint

- Move the "Click anywhere on the map to report an alert." hint from the
  sidebar into `.map-wrap` as a floating pill: absolutely positioned, top
  center, above Leaflet controls (z-index scale: hint sits at the detail-panel
  tier), surface background + border + shadow (no glassmorphism).
- Dismiss paths: × button, or automatically when the user first opens the
  report form. Dismissal persists in `localStorage`
  (`communityalerts.hintDismissed=1`) — a teaching aid must not nag.

## Feature 5 — Geolocation on load

- On Dashboard mount: `navigator.geolocation.getCurrentPosition` (timeout 8s,
  `enableHighAccuracy: false`).
- Granted: map flies to the position at zoom 16 (neighbourhood scale), and the
  nearby-alerts fetch + 60s refresh recenters on the user (radius unchanged,
  10km) so feed and map agree.
- Denied/unavailable/timeout: remain on the London default; one quiet info
  toast ("Showing central London — location unavailable"). No retries, no
  nagging.
- Note: requires a secure context in production (Azure ingress is HTTPS).

## Testing / verification

No web test framework exists and adding dependencies requires explicit user
approval, so verification is: `tsc --noEmit` + driving each feature in the
browser preview (toggle collapse both breakpoints, switch keyboard operation,
simulated SSE alert, hint dismissal persistence, geolocation grant/deny via
emulation). One conventional commit per feature.

## Azure deployment (separate phase — blocked on user input)

Constraint from user: very limited budget; data/queue/cache stay on external
free-tier services (Neon, Upstash, CloudAMQP) — Azure hosts compute only.

Plan when unblocked:
- **Azure Container Apps, consumption plan** — one environment; four container
  apps (web, alerts-api, ml-service, alert-processor). Workers and ml-service
  scale to zero; web + api min replicas tuned for cost (accepting cold starts).
  The monthly free grant (180k vCPU-s / 360k GiB-s) covers most low-traffic use.
- Registry: ACR Basic (~$5/mo) or GitHub Container Registry (free) — decide at
  deploy time.
- Web needs `NEXT_PUBLIC_API_URL` baked at build; API needs CORS for the web
  origin; secrets go to Container Apps secrets (not baked into images).
- CloudAMQP: user reports credentials fixed (LavinMQ console shows traffic);
  re-verify with a probe during deploy prep before wiring env vars.

Still required from user before this phase can start: `az login` on this
machine (or service principal), subscription ID, region choice.
