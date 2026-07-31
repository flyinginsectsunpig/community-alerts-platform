"use client";

import { useEffect } from "react";

import { useExiting } from "./Presence";
import { useFocusCapture } from "@/hooks/useFocusCapture";

interface ModalOverlayProps {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** Shared modal backdrop: Escape and backdrop-click both dismiss. */
export default function ModalOverlay({ label, onClose, children }: ModalOverlayProps) {
  const exiting = useExiting();
  // Modal, so Tab is trapped; focus returns to the trigger as it leaves.
  const ref = useFocusCapture<HTMLDivElement>({ active: !exiting, trap: true });

  useEffect(() => {
    // A dialog on its way out must not swallow the Escape that would close
    // whatever sits underneath it.
    if (exiting) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, exiting]);

  return (
    <div
      ref={ref}
      className={`panel-overlay${exiting ? " panel-overlay--exiting" : ""}`}
      role="dialog"
      aria-modal={exiting ? undefined : "true"}
      aria-label={label}
      tabIndex={-1}
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
