import { SEVERITY_COLORS, SEVERITY_LABELS } from "@/lib/format";
import type { Severity } from "@/lib/types";

/**
 * The dot's colour is published as `--sev` so surrounding elements (the feed
 * row's arrival wash, for one) can tint themselves to the same severity
 * without re-deriving it.
 */
export default function SeverityBadge({ severity }: { severity: Severity }) {
  const modifier =
    severity === "UNSCORED" ? " severity-badge--pending"
    : severity === "CRITICAL" ? " severity-badge--critical"
    : "";

  return (
    <span
      className={`severity-badge${modifier}`}
      style={{ "--sev": SEVERITY_COLORS[severity] } as React.CSSProperties}
    >
      <span className="severity-dot" aria-hidden />
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
