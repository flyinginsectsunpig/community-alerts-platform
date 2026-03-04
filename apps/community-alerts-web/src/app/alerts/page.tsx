import type { Metadata } from 'next';
import { AlertsFeed } from '@/components/alerts/AlertsFeed';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'CommunityAlerts — Alerts Feed' };

export default function AlertsPage() {
  return <AlertsFeed />;
}