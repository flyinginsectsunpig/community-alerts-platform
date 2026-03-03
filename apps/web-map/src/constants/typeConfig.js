export const TYPE_CONFIG = {
  crime: { label: 'Crime', icon: '🔴', color: '#ef4444', emoji: '🚨' },
  accident: { label: 'Accident', icon: '🚗', color: '#f97316', emoji: '🚗' },
  power: { label: 'Power Outage', icon: '⚡', color: '#eab308', emoji: '⚡' },
  suspicious: { label: 'Suspicious', icon: '👁️', color: '#a855f7', emoji: '👁️' },
  fire: { label: 'Fire', icon: '🔥', color: '#f43f5e', emoji: '🔥' },
  info: { label: 'Info', icon: 'ℹ️', color: '#3b82f6', emoji: 'ℹ️' },
};

export const UI_TO_BACKEND_TYPE = {
  crime: 'CRIME',
  accident: 'ACCIDENT',
  power: 'POWER_OUTAGE',
  suspicious: 'SUSPICIOUS',
  fire: 'FIRE',
  info: 'INFO',
};

export const BACKEND_TO_UI_TYPE = {
  CRIME: 'crime',
  ACCIDENT: 'accident',
  POWER_OUTAGE: 'power',
  SUSPICIOUS: 'suspicious',
  FIRE: 'fire',
  INFO: 'info',
};

export const DEFAULT_FILTERS = new Set(Object.keys(TYPE_CONFIG));
