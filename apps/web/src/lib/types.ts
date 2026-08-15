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
  riskScore: number;
  modelVersion: string;
}

export interface CreateWatchZoneInput {
  name: string;
  centerLat: number;
  centerLng: number;
  radiusM: number;
  categories: AlertCategory[];
}

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
  radiusM: number;
  categories: AlertCategory[];
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

/** In-progress watch zone being shaped on the map before submission. */
export interface ZoneDraft {
  center: LatLng;
  radiusM: number;
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
