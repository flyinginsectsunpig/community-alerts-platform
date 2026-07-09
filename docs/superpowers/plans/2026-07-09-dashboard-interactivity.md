# Dashboard Interactivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five approved interactivity features to the Community Alerts web dashboard: collapsible sidebar, hotspot switch control, state-driven motion, floating map hint, and geolocation-on-load.

**Architecture:** All changes live in `apps/web/src` (Next.js 14 app router, client components, vanilla-CSS token system in `globals.css`). `Dashboard.tsx` owns new UI state (sidebar open, hint dismissed, live-alert ids, map center); presentational components receive props. Leaflet-specific behavior stays inside `AlertMap.tsx`.

**Tech Stack:** Next.js 14, React 18, react-leaflet 4, vanilla CSS. **No new dependencies.**

## Global Constraints

- No new npm packages; no test framework exists — each task's verify cycle is `npm run typecheck --prefix apps/web` + the listed browser-preview checks (dev server via preview_start "web").
- Follow the existing token system (`--accent`, `--surface-2`, `--speed`, `--ease-out`, etc.) and BEM-ish class naming.
- Motion must respect the existing global `@media (prefers-reduced-motion: reduce)` kill switch (already in `globals.css` — no per-feature work needed, just don't bypass it).
- Conventional commit per task, ending with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Do not modify `AlertMap`'s StrictMode/react-leaflet dev-console noise behavior — a separate background task owns that.

---

### Task 1: Collapsible sidebar

**Files:**
- Modify: `apps/web/src/components/Dashboard.tsx` (topbar button, sidebar class/state)
- Modify: `apps/web/src/components/AlertMap.tsx` (MapResize helper)
- Modify: `apps/web/src/app/globals.css` (collapse styles)

**Interfaces:**
- Produces: `sidebarOpen: boolean` state in Dashboard; `.sidebar--closed` CSS modifier; `MapResize` component (renders null, keeps Leaflet sized).

- [ ] **Step 1: Add state + toggle button + sidebar id/class in Dashboard.tsx**

```tsx
const [sidebarOpen, setSidebarOpen] = useState(true);
```

Topbar, before `.topbar__brand` inside a new wrapper (button first child of `.topbar`):

```tsx
<div className="topbar__brand">
  <button
    type="button"
    className="btn-icon panel-toggle"
    aria-expanded={sidebarOpen}
    aria-controls="sidebar"
    aria-label={sidebarOpen ? "Hide panel" : "Show panel"}
    onClick={() => setSidebarOpen((open) => !open)}
  >
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" />
      <line x1="6" y1="2.5" x2="6" y2="13.5" stroke="currentColor" />
    </svg>
  </button>
  <span className="topbar__logo" aria-hidden>⚠</span>
  <h1>Community Alerts</h1>
</div>
```

Sidebar element:

```tsx
<aside id="sidebar" className={`sidebar${sidebarOpen ? "" : " sidebar--closed"}`}>
```

- [ ] **Step 2: Collapse CSS in globals.css**

```css
.sidebar {
  /* existing rules stay */
  transition: width 200ms ease, padding 200ms ease;
}

.sidebar > * {
  min-width: 336px; /* content keeps its width while the container clips */
}

.sidebar--closed {
  width: 0;
  padding-left: 0;
  padding-right: 0;
  border-right: none;
  overflow: hidden;
}
```

Inside the existing `@media (max-width: 860px)` block:

```css
  .sidebar {
    transition: max-height 200ms ease, padding 200ms ease;
  }
  .sidebar--closed {
    max-height: 0;
    padding: 0;
    border-top: none;
  }
```

- [ ] **Step 3: MapResize helper in AlertMap.tsx**

```tsx
function MapResize() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}
```

Render `<MapResize />` next to `<ClickCapture …/>` inside `MapContainer`.

- [ ] **Step 4: Verify** — typecheck passes; in preview: click toggle → sidebar animates closed, map repaints to full width (no gray dead zone); toggle again → restores; repeat at mobile preset (sheet collapses); `aria-expanded` flips.

- [ ] **Step 5: Commit** `feat(web): collapsible sidebar with map resize handling`

---

### Task 2: Hotspot switch control

**Files:**
- Modify: `apps/web/src/components/Dashboard.tsx` (label markup)
- Modify: `apps/web/src/app/globals.css` (switch styles; drop checkbox accent-color reliance for this control)

**Interfaces:**
- Produces: `.switch__input` + `.switch` CSS pattern (reusable for future toggles).

- [ ] **Step 1: Markup**

```tsx
<label className="hotspot-toggle">
  <input
    type="checkbox"
    className="switch__input"
    checked={showHotspots}
    onChange={(event) => setShowHotspots(event.target.checked)}
  />
  <span className="switch" aria-hidden />
  Hotspots
</label>
```

- [ ] **Step 2: CSS** (add `position: relative` to `.hotspot-toggle`)

```css
.switch__input {
  position: absolute;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  overflow: hidden;
}

.switch {
  position: relative;
  width: 34px;
  height: 18px;
  border-radius: 999px;
  background: var(--grid);
  border: 1px solid var(--border);
  flex-shrink: 0;
  transition: background 150ms ease, border-color 150ms ease;
}

.switch::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--ink-2);
  transition: transform 150ms ease, background 150ms ease;
}

.switch__input:checked + .switch {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
}

.switch__input:checked + .switch::after {
  transform: translateX(16px);
  background: #ffffff;
}

.switch__input:focus-visible + .switch {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- [ ] **Step 3: Verify** — typecheck; in preview: switch renders as pill, click toggles knob + accent fill, hotspot layer state still flips (checkbox `checked` in snapshot), keyboard Space toggles with visible focus ring.

- [ ] **Step 4: Commit** `feat(web): switch control for the hotspot layer`

---

### Task 3: State-driven motion pass

**Files:**
- Modify: `apps/web/src/components/Dashboard.tsx` (track live-arrived ids)
- Modify: `apps/web/src/components/AlertFeed.tsx` (`newIds` prop → `feed-item--new`; `fade-in` on list)
- Modify: `apps/web/src/components/StatsPanel.tsx` (`fade-in` on loaded content root)
- Modify: `apps/web/src/components/AlertMap.tsx` (critical marker halo)
- Modify: `apps/web/src/app/globals.css` (keyframes)

**Interfaces:**
- Consumes: `upsertAlert` SSE path in Dashboard.
- Produces: `newIds: ReadonlySet<string>` prop on AlertFeed; `.feed-item--new`, `.fade-in`, `.marker--critical` classes.

- [ ] **Step 1: Track live ids in Dashboard** (inside the `useLiveAlerts` callback, alert branch)

```tsx
const [liveIds, setLiveIds] = useState<ReadonlySet<string>>(new Set());
// in the SSE alert branch, after upsertAlert(event.alert):
setLiveIds((ids) => new Set(ids).add(event.alert.id));
window.setTimeout(() => {
  setLiveIds((ids) => {
    const next = new Set(ids);
    next.delete(event.alert.id);
    return next;
  });
}, 2000);
```

Pass `newIds={liveIds}` to `AlertFeed`.

- [ ] **Step 2: AlertFeed applies classes**

```tsx
className={`feed-item${alert.id === selectedId ? " feed-item--active" : ""}${
  newIds.has(alert.id) ? " feed-item--new" : ""
}`}
```

List root becomes `<ul className="feed__list fade-in">`; StatsPanel's loaded `<section>` content wrapper gets `fade-in` (wrap the loaded branch children in `<div className="fade-in">…</div>` or add the class to existing roots).

- [ ] **Step 3: Critical marker halo in AlertMap**

```tsx
pathOptions={{
  color: alert.severity === "CRITICAL" ? SEVERITY_COLORS.CRITICAL : "#1a1a19",
  weight: 2,
  fillColor: SEVERITY_COLORS[alert.severity],
  fillOpacity: 0.95,
  className: alert.severity === "CRITICAL" ? "marker--critical" : undefined,
}}
```

- [ ] **Step 4: Keyframes in globals.css**

```css
@keyframes fade-in {
  from { opacity: 0; }
}

.fade-in {
  animation: fade-in 150ms ease;
}

@keyframes feed-item-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}

@keyframes feed-item-wash {
  from {
    background-color: color-mix(in srgb, var(--accent) 22%, var(--surface-2));
  }
}

.feed-item--new {
  animation:
    feed-item-in 200ms var(--ease-out),
    feed-item-wash 1.5s ease-out;
}

@keyframes bar-grow {
  from { transform: scaleY(0); }
}

.stats__day-bar {
  transform-origin: bottom;
  animation: bar-grow 300ms var(--ease-out);
}

.stats__category-bar {
  transition: width 300ms var(--ease-out);
}

@keyframes marker-pulse {
  0%, 100% {
    stroke-width: 2;
    stroke-opacity: 0.85;
  }
  50% {
    stroke-width: 7;
    stroke-opacity: 0.15;
  }
}

.marker--critical {
  animation: marker-pulse 1.6s ease-in-out infinite;
}
```

- [ ] **Step 5: Verify** — typecheck; in preview: simulate an SSE alert is not possible without the API, so verify `feed-item--new` by temporarily seeding `liveIds` via React devtools is overkill — instead verify the CSS classes exist and the wash/slide animation via a quick `preview_eval` that adds `feed-item--new` to a rendered feed item (requires API data; if API is down, verify keyframes compile and `.fade-in` runs on stats skeleton→unavailable transition). Marker pulse: verifiable only with alert data; confirm class lands in the DOM when data exists, else defer to post-deploy smoke.

- [ ] **Step 6: Commit** `feat(web): state-driven motion for live alerts, stats and critical markers`

---

### Task 4: Floating map hint

**Files:**
- Modify: `apps/web/src/components/Dashboard.tsx` (hint state + markup move)
- Modify: `apps/web/src/app/globals.css` (`.map-hint`; delete `.sidebar__hint`)

**Interfaces:**
- Consumes: `handleMapClick` (auto-dismiss), `.map-wrap` positioning context.
- Produces: localStorage key `communityalerts.hintDismissed`.

- [ ] **Step 1: State + handlers in Dashboard**

```tsx
const HINT_KEY = "communityalerts.hintDismissed";
const [showHint, setShowHint] = useState(false);

useEffect(() => {
  setShowHint(window.localStorage.getItem(HINT_KEY) !== "1");
}, []);

const dismissHint = useCallback(() => {
  setShowHint(false);
  window.localStorage.setItem(HINT_KEY, "1");
}, []);
```

In `handleMapClick`, call `dismissHint()` (learning moment). Remove the
`<p className="sidebar__hint">…</p>` from the sidebar. Inside `.map-wrap`, after `<AlertMap …/>`:

```tsx
{showHint && (
  <div className="map-hint" role="note">
    Click anywhere on the map to report an alert.
    <button type="button" className="btn-icon" onClick={dismissHint} aria-label="Dismiss hint">
      ×
    </button>
  </div>
)}
```

- [ ] **Step 2: CSS** (replace the `.sidebar__hint` block)

```css
.map-hint {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: calc(100% - 24px);
  padding: 5px 6px 5px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
  color: var(--ink-2);
  font-size: 13px;
  animation: toast-in var(--speed) var(--ease-out);
}
```

- [ ] **Step 3: Verify** — typecheck; preview: pill floats top-center of the map; × removes it; reload → stays gone (localStorage); clear key + reload → returns; map click dismisses it; mobile preset: pill wraps within width.

- [ ] **Step 4: Commit** `feat(web): floating dismissible map hint`

---

### Task 5: Geolocation on load

**Files:**
- Modify: `apps/web/src/components/Dashboard.tsx` (center state, geolocate effect)
- Modify: `apps/web/src/components/AlertMap.tsx` (focus zoom support)

**Interfaces:**
- Produces: `FocusTarget = LatLng & { zoom?: number }` used for `focus` prop/state.

- [ ] **Step 1: Focus type + FlyTo zoom in AlertMap**

```tsx
export type FocusTarget = LatLng & { zoom?: number };
// FlyTo:
map.flyTo([focus.lat, focus.lng], focus.zoom ?? Math.max(map.getZoom(), 15), { duration: 0.8 });
```

Update `AlertMapProps.focus: FocusTarget | null`.

- [ ] **Step 2: Center state + geolocate effect in Dashboard**

```tsx
const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER);

useEffect(() => {
  if (!("geolocation" in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const located = { lat: position.coords.latitude, lng: position.coords.longitude };
      setCenter(located);
      setFocus({ ...located, zoom: 16 });
    },
    () => showToast("info", "Showing central London — location unavailable"),
    { enableHighAccuracy: false, timeout: 8000 },
  );
}, [showToast]);
```

`loadEverything` effect: change `api.fetchNearby(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, INITIAL_RADIUS_M)` to use `center`, add `center` to the effect deps (interval re-arms on recenter). `focus` state type becomes `FocusTarget | null`.

- [ ] **Step 3: Verify** — typecheck; preview denied path: toast "Showing central London — location unavailable" appears (headless denies). Granted path: `preview_eval` stubs `navigator.geolocation.getCurrentPosition = (ok) => ok({ coords: { latitude: 48.8566, longitude: 2.3522 } })`, then trigger a Dashboard remount via HMR (whitespace edit) — map flies to Paris at zoom 16 and the nearby fetch fires with the new coords (check `preview_network` for `lat=48.85…`).

- [ ] **Step 4: Commit** `feat(web): open on the user's location and recenter alert fetches`

---

## Self-review

- Spec coverage: features 1–5 all have tasks; Azure phase is explicitly out of plan scope (blocked on credentials) per spec.
- Placeholder scan: none; Task 3's verification honestly notes the SSE/marker checks that need live data and their fallback.
- Type consistency: `FocusTarget` defined once (Task 5) and consumed by Dashboard/AlertMap; `newIds: ReadonlySet<string>` matches between Dashboard and AlertFeed.
