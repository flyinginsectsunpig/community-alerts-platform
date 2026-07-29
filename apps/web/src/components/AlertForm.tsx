"use client";

import { useEffect, useState } from "react";

import ModalOverlay from "./ModalOverlay";
import SeverityBadge from "./SeverityBadge";
import { api, ApiError } from "@/lib/api";
import { CATEGORY_LABELS } from "@/lib/format";
import type { Alert, AlertCategory, LatLng, SeverityPreview } from "@/lib/types";
import { ALERT_CATEGORIES } from "@/lib/types";

const PREVIEW_DEBOUNCE_MS = 600;
const MIN_DESCRIPTION_LENGTH = 10;

interface AlertFormProps {
  point: LatLng;
  onClose: () => void;
  onCreated: (alert: Alert) => void;
  onSwitchToZone: () => void;
}

export default function AlertForm({ point, onClose, onCreated, onSwitchToZone }: AlertFormProps) {
  const [category, setCategory] = useState<AlertCategory>("THEFT");
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<SeverityPreview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live AI triage: debounce the description into the severity-preview
  // endpoint so reporters see the model's read as they type.
  useEffect(() => {
    if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(() => {
      api
        .previewSeverity(description.trim())
        .then(setPreview)
        .catch(() => setPreview(null)); // preview is best-effort UX sugar
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [description]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const alert = await api.createAlert({
        category,
        description: description.trim(),
        lat: point.lat,
        lng: point.lng,
      });
      onCreated(alert);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not submit the report — try again");
      setSubmitting(false);
    }
  }

  return (
    <ModalOverlay label="Report an alert" onClose={onClose}>
      <form className="panel" onSubmit={handleSubmit}>
        <div className="panel__header">
          <h2>Report an alert</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <p className="panel__hint">
          Pinned at {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
        </p>

        <label className="field">
          <span>Category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as AlertCategory)}
          >
            {ALERT_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>What happened?</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe what you saw (at least 10 characters)…"
            // See AuthModal: useFocusCapture owns initial focus in dialogs.
            data-autofocus
            rows={4}
            minLength={MIN_DESCRIPTION_LENGTH}
            maxLength={2000}
            required
          />
        </label>

        {preview && (
          <div className="ai-preview">
            <span className="ai-preview__label">AI severity estimate</span>
            <SeverityBadge severity={preview.severity} />
            <span className="ai-preview__risk">risk {(preview.riskScore * 100).toFixed(0)}%</span>
          </div>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="panel__actions">
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting || description.trim().length < MIN_DESCRIPTION_LENGTH}
          >
            {submitting ? "Submitting…" : "Submit report"}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>

        <button type="button" className="link-button" onClick={onSwitchToZone}>
          Create a watch zone here instead
        </button>
      </form>
    </ModalOverlay>
  );
}
