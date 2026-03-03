import type { Metadata } from 'next';
import { AnalyticsPage } from '@/components/analytics/AnalyticsPage';

export const metadata: Metadata = { title: 'CommunityAlerts — Analytics' };

export default function Analytics() {
  return <AnalyticsPage />;
}
