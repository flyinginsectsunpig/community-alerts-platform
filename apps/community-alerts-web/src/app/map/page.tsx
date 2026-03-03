import type { Metadata } from 'next';
import { MapView } from '@/components/map/MapView';

export const metadata: Metadata = {
  title: 'CommunityAlerts — Live Map',
};

export default function MapPage() {
  return <MapView />;
}
