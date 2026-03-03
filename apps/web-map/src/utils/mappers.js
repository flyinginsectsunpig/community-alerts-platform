import { BACKEND_TO_UI_TYPE, UI_TO_BACKEND_TYPE } from '../constants/typeConfig.js';
import { formatRelativeTime } from './format.js';

export function mapSuburbResponse(suburb) {
  return {
    id: suburb.id,
    name: suburb.name,
    lat: suburb.latitude,
    lng: suburb.longitude,
    weight: suburb.heatScore,
    incidentCount: suburb.incidentCount,
  };
}

export function mapIncidentResponse(incident) {
  return {
    id: incident.id,
    suburb: incident.suburbId,
    type: BACKEND_TO_UI_TYPE[incident.type] || 'info',
    title: incident.title,
    description: incident.description,
    tags: incident.tags || [],
    time: formatRelativeTime(incident.createdAt),
    lat: incident.latitude,
    lng: incident.longitude,
    severity: incident.severity || 3,
    comments: [],
    commentCount: incident.commentCount || 0,
    isFromBackend: true,
  };
}

export function mapCommentResponse(comment) {
  const colorPalette = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ef4444'];
  const index = Math.abs((comment.username || 'U').charCodeAt(0)) % colorPalette.length;

  return {
    user: comment.username,
    avatar: colorPalette[index],
    text: comment.text,
    time: formatRelativeTime(comment.createdAt),
    match: Boolean(comment.descriptionMatch),
  };
}

export function buildIncidentCreateRequest({ type, title, description, tags, suburbId, latitude, longitude, severity }) {
  return {
    type: UI_TO_BACKEND_TYPE[type],
    title,
    description,
    tags,
    suburbId,
    latitude,
    longitude,
    severity,
  };
}
