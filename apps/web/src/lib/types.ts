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
  severity: Severity;
  riskScore: number | null;
  status: AlertStatus;
  confirmationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertInput {
  category: AlertCategory;
  description: string;
  lat: number;
  lng: number;
}

export interface Hotspot {
  centerLat: number;
  centerLng: number;
  radiusM: number;
  count: number;
  dominantCategory: AlertCategory;
  intensity: number;
}

export interface HotspotsResponse {
  hotspots: Hotspot[];
  windowHours: number;
  sampleSize: number;
  generatedAt: string;
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
  contactEmail: string;
  centerLat: number;
  centerLng: number;
  radiusM: number;
  categories: AlertCategory[];
}

export interface WatchZone {
  id: string;
  name: string;
  contactEmail: string;
  centerLat: number;
  centerLng: number;
  radiusM: number;
  categories: AlertCategory[];
  createdAt: string;
}

export interface LiveEvent {
  type: "alert.created" | "alert.updated";
  alert: Alert;
}

export interface LatLng {
  lat: number;
  lng: number;
}
