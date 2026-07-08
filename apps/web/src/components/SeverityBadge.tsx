import { SEVERITY_COLORS, SEVERITY_LABELS } from "@/lib/format";
import type { Severity } from "@/lib/types";

export default function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`severity-badge${severity === "UNSCORED" ? " severity-badge--pending" : ""}`}>
      <span className="severity-dot" style={{ background: SEVERITY_COLORS[severity] }} aria-hidden />
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
