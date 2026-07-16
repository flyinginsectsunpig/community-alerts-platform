"use client";

import { useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import type { AuthSession } from "@/lib/auth";
import { CATEGORY_LABELS } from "@/lib/format";
import type { AlertCategory, WatchZone, ZoneDraft } from "@/lib/types";
import { ALERT_CATEGORIES } from "@/lib/types";

interface WatchZonePanelProps {
  /** Live draft shown on the map; the panel is docked so both stay visible. */
  draft: ZoneDraft;
  /** When set, the panel edits this zone instead of creating a new one. */
  editing?: WatchZone | null;
  session?: AuthSession | null;
  onRadiusChange: (radiusM: number) => void;
  onClose: () => void;
  onCreated: (zone: WatchZone) => void;
  onUpdated?: (zone: WatchZone) => void;
}

export default function WatchZonePanel({
  draft,
  editing = null,
  session = null,
  onRadiusChange,
  onClose,
  onCreated,
  onUpdated,
}: WatchZonePanelProps) {
  const [name, setName] = useState(editing?.name ?? "");
  const [contactEmail, setContactEmail] = useState(
    editing?.contactEmail ?? session?.email ?? "",
  );
  const [categories, setCategories] = useState<AlertCategory[]>(editing?.categories ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape closes the panel, unless a modal dialog is stacked above it.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (document.querySelector(".panel-overlay")) return;
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function toggleCategory(category: AlertCategory) {
    setCategories((current) =>
      current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category],
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const payload = {
      name: name.trim(),
      contactEmail: contactEmail.trim(),
      centerLat: draft.center.lat,
      centerLng: draft.center.lng,
      radiusM: draft.radiusM,
      categories,
    };
    try {
      if (editing && onUpdated) {
        onUpdated(await api.updateWatchZone(editing.id, payload));
      } else {
        onCreated(await api.createWatchZone(payload));
      }
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : `Could not ${editing ? "update" : "create"} the watch zone — try again`,
      );
      setSubmitting(false);
    }
  }

  return (
    <aside className="zone-panel" aria-label={editing ? "Edit watch zone" : "Create a watch zone"}>
      <form onSubmit={handleSubmit} className="zone-panel__form">
        <div className="panel__header">
          <h2>{editing ? `Edit “${editing.name}”` : "Create a watch zone"}</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <p className="panel__hint">
          Drag the pin or click the map to move the zone. You&apos;ll get notified about alerts
          inside the circle.
        </p>

        <label className="field">
          <span>Zone name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Home, School run"
            maxLength={120}
            autoFocus
            required
          />
        </label>

        <label className="field">
          <span>Email for notifications</span>
          <input
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>

        <label className="field">
          <span>Radius — {(draft.radiusM / 1000).toFixed(1)} km</span>
          <input
            type="range"
            min={100}
            max={10000}
            step={100}
            value={draft.radiusM}
            onChange={(event) => onRadiusChange(Number(event.target.value))}
          />
        </label>

        <fieldset className="field">
          <legend>Categories (none selected = all)</legend>
          <div className="category-grid">
            {ALERT_CATEGORIES.map((category) => (
              <label key={category} className="category-option">
                <input
                  type="checkbox"
                  checked={categories.includes(category)}
                  onChange={() => toggleCategory(category)}
                />
                {CATEGORY_LABELS[category]}
              </label>
            ))}
          </div>
        </fieldset>

        {error && <p className="form-error">{error}</p>}

        <div className="panel__actions">
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? "Saving…" : editing ? "Save changes" : "Create watch zone"}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </aside>
  );
}
