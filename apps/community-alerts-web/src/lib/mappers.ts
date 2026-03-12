import { BACKEND_TO_UI_TYPE } from '@/lib/constants';
import type { Suburb, Incident, IncidentMapDTO } from '@/lib/types';

function clampSeverity(raw: unknown): 1 | 2 | 3 | 4 | 5 {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 3;
  const rounded = Math.round(value);
  return Math.max(1, Math.min(5, rounded)) as 1 | 2 | 3 | 4 | 5;
}

export function mapSuburb(raw: any): Suburb {
  return {
    id: raw.id,
    name: raw.name,
    lat: raw.latitude ?? raw.lat,
    lng: raw.longitude ?? raw.lng,
    weight: raw.heatScore ?? raw.weight ?? 0,
    alertLevel: raw.alertLevel,
  };
}

export function mapIncident(raw: any): Incident {
  return {
    id: raw.id,
    suburb: raw.suburbId ?? raw.suburb,
    type: BACKEND_TO_UI_TYPE[raw.type] ?? 'info',
    title: raw.title,
    description: raw.description,
    tags: raw.tags ?? [],
    time: raw.createdAt
      ? new Date(raw.createdAt).toLocaleTimeString()
      : 'Unknown',
    createdAt: raw.createdAt,
    lat: raw.latitude ?? raw.lat,
    lng: raw.longitude ?? raw.lng,
    severity: clampSeverity(raw.severity),
    comments: [],
    commentCount: raw.commentCount ?? 0,
    isFromBackend: true,
  };
}

export function mapMapIncident(raw: any): IncidentMapDTO {
  return {
    id: raw.id,
    suburbId: raw.suburbId,
    type: BACKEND_TO_UI_TYPE[raw.type] ?? 'info',
    severity: clampSeverity(raw.severity),
    lat: raw.latitude ?? raw.lat,
    lng: raw.longitude ?? raw.lng,
  };
}
