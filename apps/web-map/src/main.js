import { runtimeConfig } from './config/runtimeConfig.js';
import { TYPE_CONFIG, UI_TO_BACKEND_TYPE } from './constants/typeConfig.js';
import { FALLBACK_SUBURBS, FORUM_POSTS, SEED_INCIDENTS } from './data/fallbackData.js';
import { loadLeaflet, MapManager } from './map/leaflet.js';
import { CommunityApi } from './services/communityApi.js';
import { MlApi } from './services/mlApi.js';
import { NotificationApi } from './services/notificationApi.js';
import { AppState } from './state/appState.js';
import { $, $$ } from './utils/dom.js';
import { escapeHtml } from './utils/format.js';
import {
  buildIncidentCreateRequest,
  mapCommentResponse,
  mapIncidentResponse,
  mapSuburbResponse,
} from './utils/mappers.js';
import { renderForum, renderIncidentPanel, renderSuburbList, updateStats } from './ui/renderers.js';

const javaApi = new CommunityApi(runtimeConfig.javaApiBaseUrl);
const mlApi = new MlApi(runtimeConfig.mlApiBaseUrl);
const notificationApi = new NotificationApi(runtimeConfig.csharpApiBaseUrl);
const state = new AppState([...FALLBACK_SUBURBS], [...SEED_INCIDENTS], structuredClone(FORUM_POSTS));

const LOCAL_SUBSCRIBER_ID_KEY = 'community_alerts_subscriber_id';

let mlConnected = false;
let notificationConnected = false;
let subscriberId = null;

const panelElements = {
  panel: $('incidentPanel'),
  badge: $('panelBadge'),
  title: $('panelTitle'),
  meta: $('panelMeta'),
  body: $('panelBody'),
};

const toastEl = $('toast');
const toastMsgEl = $('toastMsg');
let toastTimer;
let mapManager;

function getSuburbName(id) {
  const suburb = state.suburbs.find((item) => item.id === id);
  return suburb ? suburb.name : 'Unknown';
}

function showToast(message) {
  toastMsgEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
}

function setAddMode(value) {
  state.addMode = value;
  const addPingBtn = $('addPingBtn');
  const modeBadge = $('modeBadge');

  if (value) {
    addPingBtn.classList.add('active');
    addPingBtn.textContent = '✕ Cancel';
    modeBadge.classList.add('show');
  } else {
    addPingBtn.classList.remove('active');
    addPingBtn.textContent = '+ Add Alert';
    modeBadge.classList.remove('show');
  }

  mapManager.setCursor(value);
}

function closeModal() {
  $('modalOverlay').classList.remove('open');
}

function openModal() {
  $('modalOverlay').classList.add('open');
}

function refreshUi() {
  renderSuburbList($('suburbList'), state.suburbs);
  updateStats({
    incidents: state.incidents,
    statCrimeEl: $('statCrime'),
    statTotalEl: $('statTotal'),
    statSuburbsEl: $('statSuburbs'),
  });
  mapManager.renderSuburbCircles(state.suburbs);
  mapManager.renderIncidentMarkers(state.incidents, state.activeFilters, escapeHtml);
}

function mapUrgencyToSeverity(urgency) {
  switch (urgency) {
    case 'CRITICAL':
      return 5;
    case 'HIGH':
      return 4;
    case 'MEDIUM':
      return 3;
    case 'LOW':
      return 2;
    default:
      return 3;
  }
}

function parseIncidentDate(incident) {
  if (!incident.createdAt) return null;
  const date = new Date(incident.createdAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getSuburbIncidentMetrics(suburbId) {
  const now = Date.now();
  const msInDay = 86400000;

  const incidentsInSuburb = state.incidents.filter((incident) => incident.suburb === suburbId);

  const incidentsLast7 = incidentsInSuburb.filter((incident) => {
    const dt = parseIncidentDate(incident);
    return dt ? now - dt.getTime() <= 7 * msInDay : true;
  }).length;

  const incidentsLast30 = incidentsInSuburb.filter((incident) => {
    const dt = parseIncidentDate(incident);
    return dt ? now - dt.getTime() <= 30 * msInDay : true;
  }).length;

  const countByType = (type) => incidentsInSuburb.filter((incident) => incident.type === type).length;

  return {
    incidentsLast7,
    incidentsLast30,
    crimeCount: countByType('crime'),
    fireCount: countByType('fire'),
    suspiciousCount: countByType('suspicious'),
    accidentCount: countByType('accident'),
  };
}

async function hydrateFromBackend() {
  try {
    const suburbsResponse = await javaApi.getSuburbs();
    const suburbs = suburbsResponse.map(mapSuburbResponse);
    if (suburbs.length) {
      state.setSuburbs(suburbs);
    }

    const incidentPage = await javaApi.getIncidents(200);
    const incidents = (incidentPage.content || []).map(mapIncidentResponse);
    if (incidents.length) {
      state.setIncidents(incidents);
    }

    state.backendConnected = true;
    showToast('Connected to Java backend');
  } catch (error) {
    state.backendConnected = false;
    console.warn('Java backend bootstrap failed, using fallback data', error);
    showToast('Java backend unavailable. Using local demo data.');
  }
}

async function connectMlService() {
  try {
    const health = await mlApi.getHealth();
    mlConnected = health?.status === 'ok' || health?.status === 'initialising';
    if (mlConnected) showToast('Connected to ML service');
  } catch (error) {
    mlConnected = false;
    console.warn('ML service unavailable', error);
  }
}

function getStoredSubscriberId() {
  const raw = window.localStorage.getItem(LOCAL_SUBSCRIBER_ID_KEY);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

async function ensureNotificationSubscriber() {
  try {
    const health = await notificationApi.getHealth();
    notificationConnected = health?.status === 'ok';
    if (!notificationConnected) return;

    const stored = getStoredSubscriberId();
    if (stored) {
      try {
        await notificationApi.getSubscriber(stored);
        subscriberId = stored;
        return;
      } catch {
        window.localStorage.removeItem(LOCAL_SUBSCRIBER_ID_KEY);
      }
    }

    const unique = Date.now().toString(36);
    const created = await notificationApi.createSubscriber({
      email: `webmap+${unique}@communityalerts.local`,
      username: 'WebMapUser',
      pushToken: null,
    });

    subscriberId = created.id;
    window.localStorage.setItem(LOCAL_SUBSCRIBER_ID_KEY, String(created.id));
    showToast('Connected to notification service');
  } catch (error) {
    notificationConnected = false;
    console.warn('Notification service unavailable', error);
  }
}

async function ensureSubscribedToSuburb(suburbId, suburbName) {
  if (!notificationConnected || !subscriberId) return;

  try {
    await notificationApi.createSubscription(subscriberId, {
      suburbId,
      suburbName,
      minimumAlertLevel: 'YELLOW',
      notifyByEmail: true,
      notifyByPush: false,
    });
  } catch (error) {
    if (!String(error.message || '').includes('409')) {
      console.warn('Suburb subscription failed', error);
    }
  }
}

async function enrichIncidentWithMl(draftIncident) {
  if (!mlConnected) return draftIncident;

  const enriched = { ...draftIncident };

  try {
    const [entities, urgency] = await Promise.all([
      mlApi.extractEntities(enriched.description),
      mlApi.classifyUrgency({
        title: enriched.title,
        description: enriched.description,
        incidentType: UI_TO_BACKEND_TYPE[enriched.type],
      }),
    ]);

    const autoTags = entities?.auto_tags || [];
    if (autoTags.length) {
      enriched.tags = autoTags.slice(0, 6);
    }

    if (urgency?.urgency) {
      enriched.severity = Math.max(enriched.severity, mapUrgencyToSeverity(urgency.urgency));
    }
  } catch (error) {
    console.warn('ML entity/urgency enrichment failed', error);
  }

  try {
    const suburb = state.suburbs.find((item) => item.id === enriched.suburb);
    if (suburb) {
      const metrics = getSuburbIncidentMetrics(enriched.suburb);
      const now = new Date();

      const heat = await mlApi.predictHeat({
        suburb_id: suburb.id,
        current_score: suburb.weight,
        incidents_last_7_days: metrics.incidentsLast7,
        incidents_last_30_days: metrics.incidentsLast30,
        crime_count: metrics.crimeCount,
        fire_count: metrics.fireCount,
        suspicious_count: metrics.suspiciousCount,
        accident_count: metrics.accidentCount,
        hour_of_day: now.getHours(),
        day_of_week: (now.getDay() + 6) % 7,
      });

      if (heat?.predicted_alert_level) {
        showToast(`ML forecast: ${suburb.name} trending ${heat.predicted_alert_level}`);
      }
    }
  } catch (error) {
    console.warn('ML heat prediction failed', error);
  }

  return enriched;
}

async function openIncident(incidentId) {
  const incident = state.getIncidentById(incidentId);
  if (!incident) return;

  state.selectedIncidentId = incidentId;

  if (state.backendConnected && incident.isFromBackend) {
    try {
      const commentsResponse = await javaApi.getIncidentComments(incident.id);
      const comments = commentsResponse.map(mapCommentResponse);
      state.updateIncident(incident.id, (current) => ({
        ...current,
        comments,
        commentCount: comments.length,
      }));
    } catch (error) {
      console.warn('Failed to load comments', error);
    }
  }

  const updatedIncident = state.getIncidentById(incidentId);
  renderIncidentPanel({
    incident: updatedIncident,
    suburbName: getSuburbName(updatedIncident.suburb),
    panelElements,
    typeConfig: TYPE_CONFIG,
  });
}

function nearestSuburbId(lat, lng) {
  return state.suburbs.reduce(
    (best, suburb) => {
      const distance = Math.hypot(suburb.lat - lat, suburb.lng - lng);
      return distance < best.distance ? { id: suburb.id, distance } : best;
    },
    { id: state.suburbs[0]?.id || 'obs', distance: Number.POSITIVE_INFINITY },
  ).id;
}

async function submitPing() {
  const title = $('pingTitle').value.trim();
  const description = $('pingDesc').value.trim();
  const severity = Number.parseInt($('severityInput').value, 10);

  if (!title) {
    showToast('Please add a title');
    return;
  }

  if (!state.pendingLatLng && !description) {
    showToast('Click map to set location');
    return;
  }

  const lat = state.pendingLatLng ? state.pendingLatLng.lat : -33.955 + (Math.random() - 0.5) * 0.05;
  const lng = state.pendingLatLng ? state.pendingLatLng.lng : 18.53 + (Math.random() - 0.5) * 0.05;
  const suburbId = nearestSuburbId(lat, lng);

  const baseDraft = {
    id: Date.now(),
    suburb: suburbId,
    type: state.selectedType,
    title,
    description: description || 'Community alert - details pending.',
    tags: [],
    time: 'Just now',
    lat,
    lng,
    severity,
    comments: [],
    commentCount: 0,
  };

  const draft = await enrichIncidentWithMl(baseDraft);

  if (state.backendConnected) {
    try {
      const payload = buildIncidentCreateRequest({
        type: draft.type,
        title: draft.title,
        description: draft.description,
        tags: draft.tags,
        suburbId: draft.suburb,
        latitude: draft.lat,
        longitude: draft.lng,
        severity: draft.severity,
      });

      const createdIncident = await javaApi.createIncident(payload);
      const mapped = mapIncidentResponse(createdIncident);
      state.addIncident(mapped);

      const suburbsResponse = await javaApi.getSuburbs();
      state.setSuburbs(suburbsResponse.map(mapSuburbResponse));

      await ensureSubscribedToSuburb(mapped.suburb, getSuburbName(mapped.suburb));

      showToast(`${TYPE_CONFIG[state.selectedType].emoji} Alert saved to backend`);
      await openIncident(mapped.id);
    } catch (error) {
      console.warn('Failed to create incident in backend; using local', error);
      state.addIncident(draft);
      const suburb = state.suburbs.find((item) => item.id === suburbId);
      if (suburb) suburb.weight += state.selectedType === 'crime' ? 3 : 1;
      showToast('Backend write failed. Saved locally only.');
    }
  } else {
    state.addIncident(draft);
    const suburb = state.suburbs.find((item) => item.id === suburbId);
    if (suburb) suburb.weight += state.selectedType === 'crime' ? 3 : 1;
    showToast(`${TYPE_CONFIG[state.selectedType].emoji} Alert posted locally`);
  }

  refreshUi();
  $('pingTitle').value = '';
  $('pingDesc').value = '';
  $('locationText').textContent = 'Click map to set location, or using current';
  state.pendingLatLng = null;
  closeModal();
  setAddMode(false);
}

async function submitComment() {
  const text = $('commentInput').value.trim();
  if (!text || state.selectedIncidentId == null) return;

  const incident = state.getIncidentById(state.selectedIncidentId);
  if (!incident) return;

  if (state.backendConnected && incident.isFromBackend) {
    try {
      await javaApi.addIncidentComment(incident.id, {
        username: 'WebUser',
        text,
        descriptionMatch: false,
      });
      $('commentInput').value = '';
      await openIncident(incident.id);
      refreshUi();
      showToast('Comment saved to backend');
      return;
    } catch (error) {
      console.warn('Failed to create backend comment', error);
    }
  }

  const names = ['ZakhirM', 'AnonymousUser', 'SafetyFirst', 'WatchDog', 'ResidentCT'];
  const colors = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ef4444'];
  const index = Math.floor(Math.random() * names.length);

  state.updateIncident(state.selectedIncidentId, (current) => ({
    ...current,
    comments: [...current.comments, { user: names[index], avatar: colors[index], time: 'Just now', text }],
    commentCount: (current.commentCount || 0) + 1,
  }));

  $('commentInput').value = '';
  await openIncident(state.selectedIncidentId);
  refreshUi();
  showToast('Comment added locally');
}

function bindEvents() {
  $('typeGrid').addEventListener('click', (event) => {
    const option = event.target.closest('.type-option');
    if (!option) return;

    $$('.type-option').forEach((node) => node.classList.remove('selected'));
    option.classList.add('selected');
    state.selectedType = option.dataset.t;
  });

  $('severityInput').addEventListener('input', (event) => {
    $('severityVal').textContent = event.target.value;
  });

  $('submitPing').addEventListener('click', () => {
    submitPing().catch((error) => console.error(error));
  });

  $('commentSubmit').addEventListener('click', () => {
    submitComment().catch((error) => console.error(error));
  });

  $$('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const type = pill.dataset.type;
      if (state.activeFilters.has(type)) {
        state.activeFilters.delete(type);
        pill.classList.remove('active');
      } else {
        state.activeFilters.add(type);
        pill.classList.add('active');
      }
      mapManager.renderIncidentMarkers(state.incidents, state.activeFilters, escapeHtml);
    });
  });

  $('addPingBtn').addEventListener('click', () => {
    if (state.addMode) {
      setAddMode(false);
      closeModal();
      return;
    }

    setAddMode(true);
    showToast('Click anywhere on the map to place your alert');
  });

  $('panelClose').addEventListener('click', () => {
    panelElements.panel.classList.remove('open');
    state.selectedIncidentId = null;
  });

  $('forumBtn').addEventListener('click', () => {
    const panel = $('forumPanel');
    const isOpen = panel.classList.toggle('open');
    if (isOpen) {
      renderForum({
        forumTabsEl: $('forumTabs'),
        forumThreadEl: $('forumThread'),
        suburbs: state.suburbs,
        forumPosts: state.forumPosts,
        activeForumSuburb: state.activeForumSuburb,
      });
    }
  });

  $('forumClose').addEventListener('click', () => $('forumPanel').classList.remove('open'));
  $('modalClose').addEventListener('click', () => {
    closeModal();
    setAddMode(false);
  });
  $('modalOverlay').addEventListener('click', (event) => {
    if (event.target === $('modalOverlay')) {
      closeModal();
      setAddMode(false);
    }
  });

  document.addEventListener('click', (event) => {
    const suburbItem = event.target.closest('.suburb-item[data-suburb]');
    if (suburbItem) {
      const suburb = state.suburbs.find((item) => item.id === suburbItem.dataset.suburb);
      if (!suburb) return;
      mapManager.focusSuburb(suburb);
      $$('.suburb-item').forEach((node) => node.classList.toggle('selected', node.dataset.suburb === suburb.id));
      return;
    }

    const forumTab = event.target.closest('.forum-tab[data-forum-tab]');
    if (forumTab) {
      state.activeForumSuburb = forumTab.dataset.forumTab;
      renderForum({
        forumTabsEl: $('forumTabs'),
        forumThreadEl: $('forumThread'),
        suburbs: state.suburbs,
        forumPosts: state.forumPosts,
        activeForumSuburb: state.activeForumSuburb,
      });
      return;
    }

    const forumAction = event.target.closest('.forum-action[data-forum-action]');
    if (!forumAction) return;

    if (forumAction.dataset.forumAction === 'like') {
      const suburb = forumAction.dataset.forumSuburb;
      const index = Number.parseInt(forumAction.dataset.forumIdx, 10);
      const posts = state.forumPosts[suburb];
      if (!posts || Number.isNaN(index) || !posts[index]) return;
      posts[index].liked = !posts[index].liked;
      posts[index].likes += posts[index].liked ? 1 : -1;
      renderForum({
        forumTabsEl: $('forumTabs'),
        forumThreadEl: $('forumThread'),
        suburbs: state.suburbs,
        forumPosts: state.forumPosts,
        activeForumSuburb: state.activeForumSuburb,
      });
      return;
    }

    const user = decodeURIComponent(forumAction.dataset.forumUser || 'user');
    showToast(`Replying to ${user}...`);
  });
}

async function bootstrap() {
  try {
    await loadLeaflet();
  } catch (error) {
    $('map').innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#6b7280;font-family:monospace;font-size:13px;flex-direction:column;gap:12px"><div style="font-size:40px">🗺️</div><div style="text-align:center">Map requires network access.</div></div>';
    return;
  }

  mapManager = new MapManager({
    typeConfig: TYPE_CONFIG,
    onMapClick: (latlng) => {
      if (!state.addMode) return;
      state.pendingLatLng = latlng;
      $('locationText').textContent = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
      openModal();
    },
    onMarkerDetailsRequested: (incidentId) => {
      openIncident(incidentId).catch((error) => console.error(error));
    },
  });

  await Promise.all([
    hydrateFromBackend(),
    connectMlService(),
    ensureNotificationSubscriber(),
  ]);

  mapManager.init(state.suburbs);
  refreshUi();
  bindEvents();
}

bootstrap().catch((error) => console.error('App failed to boot', error));
