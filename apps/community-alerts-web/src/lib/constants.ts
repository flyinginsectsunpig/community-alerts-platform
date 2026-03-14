import type { TypeConfigMap, IncidentType } from '@/lib/types';

export const TYPE_CONFIG: TypeConfigMap = {
  crime:      { label: 'Crime',        icon: '🔴', color: '#ef4444', emoji: '🚨', bgClass: 'bg-crime/10 border-crime/30',     textClass: 'text-crime' },
  accident:   { label: 'Accident',     icon: '🚗', color: '#f97316', emoji: '🚗', bgClass: 'bg-accident/10 border-accident/30', textClass: 'text-accident' },
  power:      { label: 'Power Outage', icon: '⚡', color: '#eab308', emoji: '⚡', bgClass: 'bg-power/10 border-power/30',       textClass: 'text-power' },
  suspicious: { label: 'Suspicious',   icon: '👁️', color: '#a855f7', emoji: '👁️', bgClass: 'bg-suspicious/10 border-suspicious/30', textClass: 'text-suspicious' },
  fire:       { label: 'Fire',         icon: '🔥', color: '#f43f5e', emoji: '🔥', bgClass: 'bg-fire/10 border-fire/30',         textClass: 'text-fire' },
  info:       { label: 'Info',         icon: 'ℹ️', color: '#3b82f6', emoji: 'ℹ️', bgClass: 'bg-info/10 border-info/30',         textClass: 'text-info' },
};

export const UI_TO_BACKEND_TYPE: Record<IncidentType, string> = {
  crime: 'CRIME',
  accident: 'ACCIDENT',
  power: 'POWER_OUTAGE',
  suspicious: 'SUSPICIOUS',
  fire: 'FIRE',
  info: 'INFO',
};

export const BACKEND_TO_UI_TYPE: Record<string, IncidentType> = {
  CRIME: 'crime',
  ACCIDENT: 'accident',
  POWER_OUTAGE: 'power',
  SUSPICIOUS: 'suspicious',
  FIRE: 'fire',
  INFO: 'info',
};

export const SEVERITY_LABELS: Record<number, string> = {
  1: 'Minor',
  2: 'Low',
  3: 'Moderate',
  4: 'High',
  5: 'Critical',
};

export const SEVERITY_COLORS: Record<number, string> = {
  1: '#22c55e',
  2: '#84cc16',
  3: '#eab308',
  4: '#f97316',
  5: '#ef4444',
};

export const ALERT_LEVEL_COLOR: Record<string, string> = {
  GREEN:  '#22c55e',
  YELLOW: '#eab308',
  ORANGE: '#f97316',
  RED:    '#ef4444',
};

export const DEFAULT_CENTER = { lat: -28.5, lng: 25.5 };
export const DEFAULT_ZOOM = 6;
