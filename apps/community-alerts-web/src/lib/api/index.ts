// ─── HTTP Client ───────────────────────────────────────────────────────────────

class HttpClient {
  constructor(private baseUrl: string) { }

  async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { cache: 'no-store', signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
    return res.json();
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
    return res.json();
  }
}

// ─── Community API (Java) ─────────────────────────────────────────────────────

export class CommunityApi {
  private client: HttpClient;

  // Calls are routed through Next.js's /api-proxy/java rewrite, so the browser
  // always talks to the same origin. The real backend URL is resolved server-side
  // via the JAVA_API_URL env var in next.config.js — never baked into the bundle.
  constructor(baseUrl: string = '/api-proxy/java') {
    this.client = new HttpClient(baseUrl);
  }

  getSuburbs() {
    return this.client.get('/api/v1/suburbs');
  }

  getIncidents(size = 200, page = 0) {
    return this.client.get(`/api/v1/incidents?size=${size}&page=${page}`);
  }

  getIncident(id: number | string) {
    return this.client.get(`/api/v1/incidents/${id}`);
  }

  getMapData(size = 10000, page = 0, signal?: AbortSignal) {
    return this.client.get(`/api/v1/incidents/map-data?size=${size}&page=${page}`, signal);
  }

  createIncident(payload: unknown) {
    return this.client.post('/api/v1/incidents', payload);
  }

  getIncidentComments(incidentId: number | string) {
    return this.client.get(`/api/v1/incidents/${incidentId}/comments`);
  }

  addIncidentComment(incidentId: number | string, payload: unknown) {
    return this.client.post(`/api/v1/incidents/${incidentId}/comments`, payload);
  }

  getForumPosts(suburbId?: string) {
    const path = suburbId ? `/api/v1/forum?suburbId=${suburbId}` : '/api/v1/forum';
    return this.client.get(path);
  }

  createForumPost(payload: unknown) {
    return this.client.post('/api/v1/forum', payload);
  }
}

// ─── ML API (Python) ──────────────────────────────────────────────────────────

export class MlApi {
  private client: HttpClient;

  constructor(baseUrl: string = '/api-proxy/ml') {
    this.client = new HttpClient(baseUrl);
  }

  getHealth() {
    return this.client.get('/api/v1/ml/health');
  }

  extractEntities(text: string) {
    return this.client.post('/extract-entities', { text });
  }

  classifyUrgency(payload: { title: string; description: string; incidentType: string }) {
    return this.client.post('/classify-urgency', payload);
  }

  predictHeat(payload: unknown) {
    return this.client.post('/predict-heat', payload);
  }

  detectPattern(suburbId: string) {
    return this.client.get(`/detect-pattern/${suburbId}`);
  }

  forecastRisk(suburbId: string) {
    return this.client.get(`/forecast-risk/${suburbId}`);
  }
}

// ─── Notification API (.NET) ──────────────────────────────────────────────────

export class NotificationApi {
  private client: HttpClient;

  constructor(baseUrl: string = '/api-proxy/notif') {
    this.client = new HttpClient(baseUrl);
  }

  getHealth() {
    return this.client.get('/api/v1/health');
  }

  createSubscriber(payload: { email: string; username: string; pushToken: string | null }) {
    return this.client.post('/api/v1/subscribers', payload);
  }

  getSubscriber(id: number) {
    return this.client.get(`/api/v1/subscribers/${id}`);
  }

  createSubscription(subscriberId: number, payload: unknown) {
    return this.client.post(`/api/v1/subscribers/${subscriberId}/subscriptions`, payload);
  }
}

// ─── Singleton instances ───────────────────────────────────────────────────────

export const communityApi = new CommunityApi();
export const mlApi = new MlApi();
export const notificationApi = new NotificationApi();