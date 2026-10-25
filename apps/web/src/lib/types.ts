export const ALERT_CATEGORIES = [
  "THEFT",
  "ASSAULT",
  "BURGLARY",
  "VANDALISM",
  "SUSPICIOUS_ACTIVITY",
  "VEHICLE_CRIME",
  "DRUGS",
  "HARASSMENT",
  "HAZARD",
  "OTHER",
] as const;

export type AlertCategory = (typeof ALERT_CATEGORIES)[number];

export type Severity = "UNSCORED" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AlertStatus = "ACTIVE" | "VERIFIED" | "RESOLVED" | "EXPIRED";

export interface Alert {
  id: string;
  category: AlertCategory;
  description: string;
  lat: number;
  lng: number;
  /** Null on alerts reported before accounts were required. */
  reportedByUserId: string | null;
  severity: Severity;
  riskScore: number | null;
  status: AlertStatus;
  confirmationCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertInput {
  category: AlertCategory;
  description: string;
  lat: number;
  lng: number;
}

export interface DayCount {
  day: string;
  count: number;
}

export interface StatsSnapshot {
  total: number;
  byCategory: Record<string, number>;
  byDay: DayCount[];
  bySeverity: Record<string, number>;
  generatedAtUtc: string;
}

export interface StatsResponse {
  source: "cache" | "database";
  stats: StatsSnapshot;
}

export interface SeverityPreview {
  severity: Severity;
  /** Null when the model abstained: no recognisable detail, so no estimate. */
  riskScore: number | null;
  modelVersion: string;
}

/** A circle sends its centre and radius; a drawn zone sends its outline and the shape it came from. */
export type ZoneGeometryInput =
  | { centerLat: number; centerLng: number; radiusM: number }
  | { polygon: LatLng[]; shape: ZoneShape };

export type CreateWatchZoneInput = {
  name: string;
  categories: AlertCategory[];
} & ZoneGeometryInput;

/** The browser's PushSubscription.toJSON() shape, minus expirationTime. */
export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface WatchZone {
  id: string;
  name: string;
  contactEmail: string | null;
  centerLat: number;
  centerLng: number;
  /** For a drawn zone, the distance from the centre to its furthest point. */
  radiusM: number;
  categories: AlertCategory[];
  /** The drawn outline; null for a circle. */
  polygon: LatLng[] | null;
  /** What the outline was built from, so it can be edited again; null for a circle. */
  shape: ZoneShape | null;
  createdAt: string;
}

/** Mirror of the API's NotificationResponse. */
export interface ZoneNotification {
  id: number;
  watchZoneId: string;
  alertId: string;
  kind: string;
  message: string;
  createdAt: string;
}

export interface AlertComment {
  id: number;
  alertId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface SignupInput {
  email: string;
  displayName: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export type DigestFrequency = "OFF" | "DAILY" | "WEEKLY";

export interface ProfileResponse {
  digestFrequency: DigestFrequency;
}

export interface AuthResponse {
  token: string;
  userId: string;
  displayName: string;
  email: string;
  expiresAt: string;
}

export type LiveEvent =
  | { type: "alert.created" | "alert.updated"; alert: Alert }
  | { type: "comment.created"; alertId: string; commentCount: number; comment: AlertComment };

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * A hand-shaped watch zone. "pulled" is a circle with points dragged out of its
 * edge; "freehand" is a drawn outline whose `handle` points the user can move.
 */
export type ZoneShape =
  | { kind: "pulled"; circle: { center: LatLng; radiusM: number }; pulls: LatLng[] }
  | { kind: "freehand"; points: { at: LatLng; handle: boolean }[] };

/** How a circle is reshaped on the map. */
export type ZoneMode = "pull" | "freehand";

/** In-progress watch zone being shaped on the map before submission. */
export interface ZoneDraft {
  center: LatLng;
  radiusM: number;
  /** Null while the draft is still a plain circle. */
  shape: ZoneShape | null;
}

export interface PoliceStation {
  id: number;
  name: string;
  district: string;
  province: string;
  lat: number;
  lng: number;
}

export interface StationTopCategory {
  category: string;
  count: number;
  prevYearCount: number | null;
}

export interface StationLatestQuarter {
  label: string;
  totalSerious: number;
  totalSeriousPrevYear: number | null;
  topCategories: StationTopCategory[];
}

/** One 3-month window ("Jan–Mar") with totals keyed by year ("2022".."2026"). */
export interface StationCategoryPeriod {
  months: string;
  totals: Record<string, number>;
}

export interface StationCategoryStats {
  category: string;
  periods: StationCategoryPeriod[];
}

export interface StationStats {
  station: PoliceStation;
  latestQuarter: StationLatestQuarter | null;
  categories: StationCategoryStats[];
}

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}
