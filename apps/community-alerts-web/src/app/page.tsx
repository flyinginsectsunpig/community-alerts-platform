import type { Metadata } from 'next';
import { DashboardPage } from '@/components/DashboardPage';

export const metadata: Metadata = {
  title: 'CommunityAlerts — Dashboard',
};

export default function Home() {
  return <DashboardPage />;
}
