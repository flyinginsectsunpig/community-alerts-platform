import { redirect } from 'next/navigation';

/**
 * Redirects legacy /forum route to the new SOC Shell at /
 */
export default function ForumRedirect() {
  redirect('/');
}