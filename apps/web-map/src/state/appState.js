import { DEFAULT_FILTERS } from '../constants/typeConfig.js';

export class AppState {
  constructor(suburbs, incidents, forumPosts) {
    this.suburbs = suburbs;
    this.incidents = incidents;
    this.forumPosts = forumPosts;
    this.activeFilters = new Set(DEFAULT_FILTERS);
    this.selectedIncidentId = null;
    this.selectedType = 'crime';
    this.pendingLatLng = null;
    this.addMode = false;
    this.backendConnected = false;
    this.activeForumSuburb = 'khaye';
  }

  setSuburbs(suburbs) {
    this.suburbs = suburbs;
  }

  setIncidents(incidents) {
    this.incidents = incidents;
  }

  addIncident(incident) {
    this.incidents.push(incident);
  }

  updateIncident(incidentId, updater) {
    this.incidents = this.incidents.map((incident) =>
      incident.id === incidentId ? updater(incident) : incident,
    );
  }

  getIncidentById(incidentId) {
    return this.incidents.find((incident) => incident.id === incidentId);
  }
}
