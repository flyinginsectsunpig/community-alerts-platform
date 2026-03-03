import { HttpClient } from './httpClient.js';

export class CommunityApi {
  constructor(javaApiBaseUrl) {
    this.client = new HttpClient(javaApiBaseUrl);
  }

  getSuburbs() {
    return this.client.get('/api/v1/suburbs');
  }

  getIncidents(size = 200) {
    return this.client.get(`/api/v1/incidents?size=${size}`);
  }

  createIncident(payload) {
    return this.client.post('/api/v1/incidents', payload);
  }

  getIncidentComments(incidentId) {
    return this.client.get(`/api/v1/incidents/${incidentId}/comments`);
  }

  addIncidentComment(incidentId, payload) {
    return this.client.post(`/api/v1/incidents/${incidentId}/comments`, payload);
  }
}
