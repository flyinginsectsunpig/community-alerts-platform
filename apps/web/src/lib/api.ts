import { getFingerprint } from "./fingerprint";
import type {
  Alert,
  AlertCategory,
  CreateAlertInput,
  CreateWatchZoneInput,
  HotspotsResponse,
  SeverityPreview,
  StatsResponse,
  WatchZone,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export const liveStreamUrl = `${API_BASE}/api/v1/alerts/stream`;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Client-Fingerprint": getFingerprint(),
      ...init.headers,
    },
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // Non-JSON error body; keep the default message.
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

export const api = {
  fetchNearby(lat: number, lng: number, radiusM: number, sinceHours = 720): Promise<Alert[]> {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radiusM: String(radiusM),
      sinceHours: String(sinceHours),
    });
    return request<Alert[]>(`/api/v1/alerts/nearby?${params}`);
  },

  createAlert(input: CreateAlertInput): Promise<Alert> {
    return request<Alert>("/api/v1/alerts", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  confirmAlert(id: string): Promise<Alert> {
    return request<Alert>(`/api/v1/alerts/${id}/confirm`, { method: "POST" });
  },

  previewSeverity(text: string): Promise<SeverityPreview> {
    return request<SeverityPreview>("/api/v1/alerts/severity-preview", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },

  fetchStats(): Promise<StatsResponse> {
    return request<StatsResponse>("/api/v1/stats/summary");
  },

  fetchHotspots(windowHours = 168): Promise<HotspotsResponse> {
    return request<HotspotsResponse>(`/api/v1/hotspots?windowHours=${windowHours}`);
  },

  createWatchZone(input: CreateWatchZoneInput): Promise<WatchZone> {
    return request<WatchZone>("/api/v1/watch-zones", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};

export type { AlertCategory };
