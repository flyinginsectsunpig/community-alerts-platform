import { redirect } from 'next/navigation';

/**
 * Redirects legacy /suburb/[id] route to the new SOC Shell at /?suburb=[id]
 */
export default function SuburbRedirect({ params }: { params: { id: string } }) {
  redirect(`/?suburb=\${params.id}`);
}