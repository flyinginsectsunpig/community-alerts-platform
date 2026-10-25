"use client";

import { useEffect, useMemo, useState } from "react";

import { OPEN_MODAL, useExiting } from "./Presence";
import { useFocusCapture } from "@/hooks/useFocusCapture";
import { api, ApiError } from "@/lib/api";
import type { AuthSession } from "@/lib/auth";
import { CATEGORY_LABELS } from "@/lib/format";
import type { AlertCategory, WatchZone, ZoneDraft, ZoneMode } from "@/lib/types";
import { ALERT_CATEGORIES } from "@/lib/types";
import { outline, validateOutline, zonePayload } from "@/lib/zoneShape";

const HINTS: Record<ZoneMode, string> = {
  pull: "Drag the pin to move the zone. Grab its edge to pull it into shape.",
  freehand:
    "Draw round your area. Let go to zoom or move the map, then carry on from the end of your line.",
};

const START_FROM_END_HINT = "Start from the end of your line";

const MODES: { mode: ZoneMode; label: string }[] = [
  { mode: "pull", label: "Pull to shape" },
  { mode: "freehand", label: "Freehand" },
];

const PENS = [
  { down: true, label: "Draw" },
  { down: false, label: "Move map" },
];

interface WatchZonePanelProps {
  /** Live draft shown on the map; the panel is docked so both stay visible. */
  draft: ZoneDraft;
  /** When set, the panel edits this zone instead of creating a new one. */
  editing?: WatchZone | null;
  session?: AuthSession | null;
  mode: ZoneMode;
  onModeChange: (mode: ZoneMode) => void;
  /** Freehand: whether a press on the map draws (true) or moves the map (false). */
  penDown: boolean;
  onPenToggle: () => void;
  onUndoPiece: () => void;
  onClearPieces: () => void;
  onFinishFreehand: () => void;
  /** Freehand: there are enough points drawn to make a shape. */
  canFinish: boolean;
  /** Freehand: there is a drawn piece to undo or clear. */
  hasPieces: boolean;
  /** Freehand: the last press with the pen down was too far from the end of the line. */
  startedAwayFromEnd: boolean;
  onRadiusChange: (radiusM: number) => void;
  onResetToCircle: () => void;
  onClose: () => void;
  onCreated: (zone: WatchZone) => void;
  onUpdated?: (zone: WatchZone) => void;
}

export default function WatchZonePanel({
  draft,
  editing = null,
  session = null,
  mode,
  onModeChange,
  penDown,
  onPenToggle,
  onUndoPiece,
  onClearPieces,
  onFinishFreehand,
  canFinish,
  hasPieces,
  startedAwayFromEnd,
  onRadiusChange,
  onResetToCircle,
  onClose,
  onCreated,
  onUpdated,
}: WatchZonePanelProps) {
  const [name, setName] = useState(editing?.name ?? "");
  const [categories, setCategories] = useState<AlertCategory[]>(editing?.categories ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shapeError = useMemo(
    () => (draft.shape ? validateOutline(outline(draft.shape)) : null),
    [draft.shape],
  );
  const exiting = useExiting();
  const panelRef = useFocusCapture<HTMLElement>({ active: !exiting, trap: false });

  // Escape closes the panel, unless a modal dialog is stacked above it.
  useEffect(() => {
    if (exiting) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (document.querySelector(OPEN_MODAL)) return;
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, exiting]);

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
    const payload = { name: name.trim(), categories, ...zonePayload(draft) };
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
    <aside
      ref={panelRef}
      className={`zone-panel${exiting ? " zone-panel--exiting" : ""}`}
      aria-label={editing ? "Edit watch zone" : "Create a watch zone"}
      tabIndex={-1}
    >
      <form onSubmit={handleSubmit} className="zone-panel__form">
        <div className="panel__header">
          <h2>{editing ? `Edit “${editing.name}”` : "Create a watch zone"}</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="mode-switch" role="group" aria-label="How to shape the zone">
          {MODES.map(({ mode: option, label }) => (
            <button
              key={option}
              type="button"
              className="mode-switch__option"
              aria-pressed={mode === option}
              onClick={() => onModeChange(option)}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "freehand" && (
          <>
            <div className="mode-switch" role="group" aria-label="What a drag on the map does">
              {PENS.map(({ down, label }) => (
                <button
                  key={label}
                  type="button"
                  className="mode-switch__option"
                  aria-pressed={penDown === down}
                  onClick={() => penDown !== down && onPenToggle()}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="panel__actions">
              <button type="button" className="btn btn--small" onClick={onUndoPiece} disabled={!hasPieces}>
                Undo
              </button>
              <button type="button" className="btn btn--small" onClick={onClearPieces} disabled={!hasPieces}>
                Clear
              </button>
              <button
                type="button"
                className="btn btn--small btn--primary"
                onClick={onFinishFreehand}
                disabled={!canFinish}
              >
                Finish shape
              </button>
            </div>
          </>
        )}

        <p className="panel__hint">
          {mode === "freehand" && startedAwayFromEnd ? START_FROM_END_HINT : HINTS[mode]}
        </p>
        {shapeError && <p className="form-error">{shapeError}</p>}

        <label className="field">
          <span>Zone name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Home, School run"
            maxLength={120}
            // useFocusCapture owns initial focus here now; React's autoFocus
            // fires during commit and raced it.
            data-autofocus
            required
          />
        </label>

        {draft.shape ? (
          <button type="button" className="btn btn--small" onClick={onResetToCircle}>
            Reset to circle
          </button>
        ) : (
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
        )}

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
          <button type="submit" className="btn btn--primary" disabled={submitting || shapeError !== null}>
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
