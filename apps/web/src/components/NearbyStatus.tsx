import { ChevronDownIcon } from "./icons";
import { CATEGORY_LABELS, SEVERITY_COLORS, timeAgo } from "@/lib/format";
import { isSerious, nearbyStatus } from "@/lib/status";
import type { Alert } from "@/lib/types";

interface NearbyStatusProps {
  /** Unfiltered: narrowing the feed must not change what is true nearby. */
  alerts: Alert[];
  onOpen: (alert: Alert) => void;
}

/** The first thing to read: what is going on around here, and how bad it is. */
export default function NearbyStatusBanner({ alerts, onOpen }: NearbyStatusProps) {
  const { level, headline, lead } = nearbyStatus(alerts);
  const className = `status-banner${isSerious(level) ? " status-banner--serious" : ""}`;
  const style = (level ? { "--sev": SEVERITY_COLORS[level] } : undefined) as
    | React.CSSProperties
    | undefined;

  if (!lead) {
    return (
      <div className={className} role="status">
        <span className="status-banner__text">
          <span className="status-banner__headline">{headline}</span>
          <span className="status-banner__detail">Based on what neighbours have reported.</span>
        </span>
      </div>
    );
  }

  return (
    <button type="button" className={className} style={style} onClick={() => onOpen(lead)}>
      <span className="status-banner__text">
        <span className="status-banner__headline">{headline}</span>
        <span className="status-banner__detail">
          Latest: {CATEGORY_LABELS[lead.category]}, {timeAgo(lead.createdAt)}
        </span>
      </span>
      <ChevronDownIcon size={20} />
    </button>
  );
}
