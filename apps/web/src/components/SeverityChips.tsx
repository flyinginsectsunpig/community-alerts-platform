import { SEVERITY_COLORS, SEVERITY_LABELS } from "@/lib/format";
import type { AlertFilter } from "@/lib/filter";
import type { Severity } from "@/lib/types";

/** Worst first, because that is the filter people reach for. */
const ORDER: readonly Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNSCORED"];

interface SeverityChipsProps {
  bySeverity: Record<string, number>;
  /** Drives each chip's pressed state. */
  filter: AlertFilter;
  onToggle: (severity: Severity) => void;
}

export default function SeverityChips({ bySeverity, filter, onToggle }: SeverityChipsProps) {
  const entries = ORDER.filter((severity) => (bySeverity[severity] ?? 0) > 0);
  if (entries.length === 0) return null;

  return (
    <div className="stats__severities">
      {entries.map((severity) => {
        const count = bySeverity[severity];
        const on = filter.severities.has(severity);
        return (
          <button
            key={severity}
            type="button"
            className={`severity-chip severity-chip--button${on ? " severity-chip--on" : ""}`}
            aria-pressed={on}
            title={`${count} in the last 7 days — click to ${on ? "stop filtering" : "filter"}`}
            // On the chip rather than the dot, so the pressed background can
            // tint toward this severity too.
            style={{ "--sev": SEVERITY_COLORS[severity] } as React.CSSProperties}
            onClick={() => onToggle(severity)}
          >
            <span className="severity-dot" aria-hidden />
            {SEVERITY_LABELS[severity]} {count}
          </button>
        );
      })}
    </div>
  );
}
