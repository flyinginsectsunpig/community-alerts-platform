"use client";

import { useEffect } from "react";

interface ModalOverlayProps {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** Shared modal backdrop: Escape and backdrop-click both dismiss. */
export default function ModalOverlay({ label, onClose, children }: ModalOverlayProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="panel-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onMouseDown={(event) => {
        // Only a press that starts on the backdrop itself dismisses; a drag
        // that ends outside the panel (e.g. selecting text) must not.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}
