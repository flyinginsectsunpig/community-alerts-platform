import type { Metadata } from 'next';
import { MapView } from '@/components/map/MapView';

// Force dynamic rendering — this page shows live incident data that must never
// be baked into a static prerender (which would flash stale seed data on load).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'CommunityAlerts — Live Map',
};

export default function MapPage() {
  return <MapView />;
}