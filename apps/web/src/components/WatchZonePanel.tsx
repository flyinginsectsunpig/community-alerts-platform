"use client";

import { useState } from "react";

import ModalOverlay from "./ModalOverlay";
import { api, ApiError } from "@/lib/api";
import { CATEGORY_LABELS } from "@/lib/format";
import type { AlertCategory, LatLng, WatchZone } from "@/lib/types";
import { ALERT_CATEGORIES } from "@/lib/types";

interface WatchZonePanelProps {
  point: LatLng;
  onClose: () => void;
  onCreated: (zone: WatchZone) => void;
}

export default function WatchZonePanel({ point, onClose, onCreated }: WatchZonePanelProps) {
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [radiusM, setRadiusM] = useState(1000);
  const [categories, setCategories] = useState<AlertCategory[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    try {
      const zone = await api.createWatchZone({
        name: name.trim(),
        contactEmail: contactEmail.trim(),
        centerLat: point.lat,
        centerLng: point.lng,
        radiusM,
        categories,
      });
      onCreated(zone);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create the watch zone — try again");
      setSubmitting(false);
    }
  }

  return (
    <ModalOverlay label="Create a watch zone" onClose={onClose}>
      <form className="panel" onSubmit={handleSubmit}>
        <div className="panel__header">
          <h2>Create a watch zone</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <p className="panel__hint">
          Get notified about alerts within {(radiusM / 1000).toFixed(1)} km of{" "}
          {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
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
          <span>Radius — {(radiusM / 1000).toFixed(1)} km</span>
          <input
            type="range"
            min={100}
            max={10000}
            step={100}
            value={radiusM}
            onChange={(event) => setRadiusM(Number(event.target.value))}
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
            {submitting ? "Creating…" : "Create watch zone"}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
