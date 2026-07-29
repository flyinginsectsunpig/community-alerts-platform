"use client";

import { useExiting } from "./Presence";

interface MapHintProps {
  children: React.ReactNode;
  /** Omit for hints that clear themselves when their condition passes. */
  onDismiss?: () => void;
}

export default function MapHint({ children, onDismiss }: MapHintProps) {
  const exiting = useExiting();

  return (
    <div className={`map-hint${exiting ? " map-hint--exiting" : ""}`} role="note">
      {children}
      {onDismiss && (
        <button type="button" className="btn-icon" onClick={onDismiss} aria-label="Dismiss hint">
          ×
        </button>
      )}
    </div>
  );
}
