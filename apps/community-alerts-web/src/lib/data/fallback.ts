// No static fallback data — the app reads exclusively from the backend APIs.
// If the backend is unreachable the UI shows empty state rather than stale data.
// To regenerate real seed data: run generate_saps_seed.py with the SAPS xlsx files.

import type { Suburb, Incident, ForumPostsBySuburb } from '@/lib/types';

export const FALLBACK_SUBURBS: Suburb[] = [];

export const SEED_INCIDENTS: Incident[] = [];

export const FORUM_POSTS: ForumPostsBySuburb = {};