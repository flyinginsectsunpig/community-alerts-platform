import { HttpClient } from './httpClient.js';

export class NotificationApi {
  constructor(csharpApiBaseUrl) {
    this.client = new HttpClient(csharpApiBaseUrl);
  }

  getHealth() {
    return this.client.get('/api/v1/health');
  }

  createSubscriber(payload) {
    return this.client.post('/api/v1/subscribers', payload);
  }

  getSubscriber(subscriberId) {
    return this.client.get(`/api/v1/subscribers/${subscriberId}`);
  }

  createSubscription(subscriberId, payload) {
    return this.client.post(`/api/v1/subscribers/${subscriberId}/subscriptions`, payload);
  }
}
