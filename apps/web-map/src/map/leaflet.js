import { heatColor } from '../utils/format.js';

export function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) {
      resolve(window.L);
      return;
    }

    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);

    const js = document.createElement('script');
    js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload = () => resolve(window.L);
    js.onerror = reject;
    document.head.appendChild(js);
  });
}

export class MapManager {
  constructor({ onMapClick, onMarkerDetailsRequested, typeConfig }) {
    this.onMapClick = onMapClick;
    this.onMarkerDetailsRequested = onMarkerDetailsRequested;
    this.typeConfig = typeConfig;
    this.markers = new Map();
    this.suburbCircles = new Map();
    this.map = null;
  }

  init(suburbs) {
    this.map = L.map('map', {
      center: [-33.96, 18.53],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OSM',
      maxZoom: 19,
    }).addTo(this.map);

    this.map.on('click', (event) => this.onMapClick(event.latlng));
    this.renderSuburbCircles(suburbs);
  }

  renderSuburbCircles(suburbs) {
    this.suburbCircles.forEach(({ circle, label }) => {
      this.map.removeLayer(circle);
      this.map.removeLayer(label);
    });
    this.suburbCircles.clear();

    suburbs.forEach((suburb) => {
      const color = heatColor(suburb.weight);
      const circle = L.circle([suburb.lat, suburb.lng], {
        radius: 800,
        color,
        fillColor: color,
        fillOpacity: 0.08,
        weight: 1.5,
        opacity: 0.5,
      }).addTo(this.map);

      const label = L.marker([suburb.lat, suburb.lng], {
        icon: L.divIcon({
          className: 'suburb-label',
          html: `<span>${suburb.name}</span>`,
          iconAnchor: [40, 8],
          iconSize: null,
        }),
        interactive: false,
      }).addTo(this.map);

      this.suburbCircles.set(suburb.id, { circle, label });
    });
  }

  renderIncidentMarkers(incidents, activeFilters, escapeHtml) {
    this.markers.forEach((marker) => this.map.removeLayer(marker));
    this.markers.clear();

    incidents.forEach((incident) => {
      if (!activeFilters.has(incident.type)) return;

      const config = this.typeConfig[incident.type];
      const marker = L.marker([incident.lat, incident.lng], {
        icon: this.#makeIcon(incident.type, incident.severity),
      }).addTo(this.map);

      const commentCount = incident.commentCount ?? incident.comments.length;
      const popup = L.popup({ className: 'dark-popup', closeButton: false, offset: [0, -14] }).setContent(`
        <div class="popup-content">
          <div class="popup-type" style="color:${config.color}">${config.emoji} ${config.label.toUpperCase()}</div>
          <div class="popup-title">${escapeHtml(incident.title)}</div>
          <div class="popup-desc">${escapeHtml(incident.description.substring(0, 90))}...</div>
          <div class="popup-footer">
            <span class="popup-time">${escapeHtml(incident.time)}</span>
            <span class="popup-comments">💬 ${commentCount}</span>
          </div>
          <button class="popup-open-btn" data-open-incident="${incident.id}">View Details & Comments</button>
        </div>
      `);

      marker.bindPopup(popup);
      marker.on('click', () => marker.openPopup());
      marker.on('popupopen', () => {
        const button = document.querySelector(`[data-open-incident="${incident.id}"]`);
        if (button) {
          button.addEventListener('click', () => this.onMarkerDetailsRequested(incident.id), { once: true });
        }
      });

      this.markers.set(incident.id, marker);
    });
  }

  focusSuburb(suburb) {
    this.map.flyTo([suburb.lat, suburb.lng], 14, { duration: 1.2 });
  }

  setCursor(mode) {
    this.map.getContainer().style.cursor = mode ? 'crosshair' : '';
  }

  #makeIcon(type, severity = 3) {
    const config = this.typeConfig[type];
    const size = 28 + (severity - 1) * 3;

    return L.divIcon({
      className: '',
      html: `<div style="width:${size}px;height:${size}px;background:${config.color}22;border:2px solid ${config.color};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${size * 0.5}px;box-shadow:0 0 ${size * 0.6}px ${config.color}55;cursor:pointer;">${config.emoji}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }
}
