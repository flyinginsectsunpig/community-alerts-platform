// ─── Incident Types ───────────────────────────────────────────────────────────

export type IncidentType = 'crime' | 'accident' | 'power' | 'suspicious' | 'fire' | 'info';

export interface Incident {
  id: number | string;
  suburb: string;
  type: IncidentType;
  title: string;
  description: string;
  tags: string[];
  time: string;
  createdAt?: string;
  lat: number;
  lng: number;
  severity: 1 | 2 | 3 | 4 | 5;
  comments: Comment[];
  commentCount: number;
  isFromBackend?: boolean;
}

export interface IncidentMapDTO {
  id: number | string;
  suburbId: string;
  type: IncidentType;
  severity: number;
  lat: number;
  lng: number;
}

export interface Comment {
  user: string;
  avatar: string;
  time: string;
  text: string;
}

// ─── Suburb Types ─────────────────────────────────────────────────────────────

export interface Suburb {
  id: string;
  name: string;
  lat: number;
  lng: number;
  weight: number;
  alertLevel?: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  incidentCount?: number;
}

// ─── Forum Types ──────────────────────────────────────────────────────────────

export interface ForumPost {
  id?: number;
  user: string;
  avatar: string;
  time: string;
  text: string;
  likes: number;
  liked: boolean;
  suburb?: string;
  replies?: ForumPost[];
}

export type ForumPostsBySuburb = Record<string, ForumPost[]>;

// ─── Analytics Types ──────────────────────────────────────────────────────────

export interface HeatDataPoint {
  hour: number;
  day: string;
  value: number;
}

export interface TrendDataPoint {
  date: string;
  crime: number;
  accident: number;
  fire: number;
  power: number;
  suspicious: number;
  info: number;
}

export interface SuburbRanking {
  suburb: string;
  name: string;
  score: number;
  change: number;
  incidents: number;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface ApiError {
  status: number;
  message: string;
  timestamp: string;
}

// ─── Store Types ──────────────────────────────────────────────────────────────

export interface AppState {
  incidents: Incident[];
  suburbs: Suburb[];
  forumPosts: ForumPostsBySuburb;
  activeFilters: Set<IncidentType>;
  selectedIncidentId: number | string | null;
  backendConnected: boolean;
  mlConnected: boolean;
  notificationConnected: boolean;
}

// ─── Type Config ──────────────────────────────────────────────────────────────

export interface TypeConfig {
  label: string;
  icon: string;
  color: string;
  emoji: string;
  bgClass: string;
  textClass: string;
}

export type TypeConfigMap = Record<IncidentType, TypeConfig>;
