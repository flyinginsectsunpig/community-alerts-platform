"use client";

import { CATEGORY_LABELS, SEVERITY_LABELS } from "@/lib/format";
import type { Alert } from "@/lib/types";

/**
 * Wording for an alert that just arrived over the stream. Severity leads,
 * because that is the thing a listener needs first.
 */
export function announcementFor(alert: Alert): string {
  const severity =
    alert.severity === "UNSCORED"
      ? "Not yet scored:"
      : `${SEVERITY_LABELS[alert.severity]} severity`;
  const category = CATEGORY_LABELS[alert.category].toLowerCase();
  return `${severity} ${category} reported nearby. ${alert.description}`;
}

interface LiveAnnouncerProps {
  /** Ordinary arrivals; queued behind whatever is being read. */
  polite: string | null;
  /** CRITICAL arrivals; interrupts, which is the point. */
  assertive: string | null;
}

/**
 * The visual side of an arriving alert is a ripple, a colour wash and a
 * severity ramp — none of which reach a screen reader. These two regions are
 * the non-visual equivalent.
 *
 * They are kept separate and always mounted: a live region has to exist in the
 * DOM before its text changes, or the change is not announced.
 */
export default function LiveAnnouncer({ polite, assertive }: LiveAnnouncerProps) {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </>
  );
}
