import { HttpClient } from './httpClient.js';

export class MlApi {
  constructor(mlApiBaseUrl) {
    this.client = new HttpClient(mlApiBaseUrl);
  }

  getHealth() {
    return this.client.get('/api/v1/ml/health');
  }

  extractEntities(text) {
    return this.client.post('/api/v1/ml/extract-entities', { text });
  }

  classifyUrgency({ title, description, incidentType }) {
    return this.client.post('/api/v1/ml/classify-urgency', {
      title,
      description,
      incident_type: incidentType,
    });
  }

  predictHeat(payload) {
    return this.client.post('/api/v1/ml/predict-heat', payload);
  }
}
