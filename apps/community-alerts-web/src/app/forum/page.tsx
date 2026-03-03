import type { Metadata } from 'next';
import { ForumPage } from '@/components/forum/ForumPage';

export const metadata: Metadata = { title: 'CommunityAlerts — Community Forum' };

export default function Forum() {
  return <ForumPage />;
}
