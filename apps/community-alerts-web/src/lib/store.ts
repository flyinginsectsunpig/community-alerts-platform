'use client';

import { create } from 'zustand';
import type { Incident, Suburb, ForumPostsBySuburb, IncidentType } from '@/lib/types';
import { FALLBACK_SUBURBS, SEED_INCIDENTS, FORUM_POSTS } from '@/lib/data/fallback';

interface Store {
  // Data
  incidents: Incident[];
  suburbs: Suburb[];
  forumPosts: ForumPostsBySuburb;

  // Connection state
  backendConnected: boolean;
  mlConnected: boolean;
  notificationConnected: boolean;

  // UI State
  activeFilters: Set<IncidentType>;
  selectedIncidentId: number | string | null;
  activeForumSuburb: string;
  addMode: boolean;
  pendingLatLng: { lat: number; lng: number } | null;
  selectedType: IncidentType;
  subscriberId: number | null;

  // Actions
  setIncidents: (incidents: Incident[]) => void;
  addIncident: (incident: Incident) => void;
  updateIncident: (id: number | string, updater: (current: Incident) => Incident) => void;
  setSuburbs: (suburbs: Suburb[]) => void;
  updateSuburbWeight: (id: string, delta: number) => void;
  setForumPosts: (posts: ForumPostsBySuburb) => void;
  toggleFilter: (type: IncidentType) => void;
  setSelectedIncident: (id: number | string | null) => void;
  setActiveForumSuburb: (id: string) => void;
  setAddMode: (value: boolean) => void;
  setPendingLatLng: (latlng: { lat: number; lng: number } | null) => void;
  setSelectedType: (type: IncidentType) => void;
  setBackendConnected: (v: boolean) => void;
  setMlConnected: (v: boolean) => void;
  setNotificationConnected: (v: boolean) => void;
  setSubscriberId: (id: number | null) => void;
}

export const useStore = create<Store>((set, get) => ({
  incidents: [],
  suburbs: [],
  forumPosts: structuredClone(FORUM_POSTS),
  backendConnected: false,
  mlConnected: false,
  notificationConnected: false,
  activeFilters: new Set<IncidentType>(['crime', 'accident', 'power', 'suspicious', 'fire', 'info']),
  selectedIncidentId: null,
  activeForumSuburb: 'khaye',
  addMode: false,
  pendingLatLng: null,
  selectedType: 'crime',
  subscriberId: null,

  setIncidents: (incidents) => set({ incidents }),
  addIncident: (incident) => set((s) => ({ incidents: [incident, ...s.incidents] })),
  updateIncident: (id, updater) => set((s) => ({
    incidents: s.incidents.map((inc) => inc.id === id ? updater(inc) : inc),
  })),
  setSuburbs: (suburbs) => set({ suburbs }),
  updateSuburbWeight: (id, delta) => set((s) => ({
    suburbs: s.suburbs.map((sub) => sub.id === id ? { ...sub, weight: sub.weight + delta } : sub),
  })),
  setForumPosts: (forumPosts) => set({ forumPosts }),
  toggleFilter: (type) => set((s) => {
    const filters = new Set(s.activeFilters);
    filters.has(type) ? filters.delete(type) : filters.add(type);
    return { activeFilters: filters };
  }),
  setSelectedIncident: (id) => set({ selectedIncidentId: id }),
  setActiveForumSuburb: (id) => set({ activeForumSuburb: id }),
  setAddMode: (value) => set({ addMode: value }),
  setPendingLatLng: (latlng) => set({ pendingLatLng: latlng }),
  setSelectedType: (type) => set({ selectedType: type }),
  setBackendConnected: (v) => set({ backendConnected: v }),
  setMlConnected: (v) => set({ mlConnected: v }),
  setNotificationConnected: (v) => set({ notificationConnected: v }),
  setSubscriberId: (id) => set({ subscriberId: id }),
}));