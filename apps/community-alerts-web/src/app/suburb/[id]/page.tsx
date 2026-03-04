import type { Metadata } from 'next';
import { SuburbDetailPage } from '@/components/SuburbDetailPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'CommunityAlerts — Suburb Detail' };

export default function SuburbPage({ params }: { params: { id: string } }) {
  return <SuburbDetailPage suburbId={params.id} />;
}