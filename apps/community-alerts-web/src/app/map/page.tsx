import { redirect } from 'next/navigation';

/**
 * Redirects legacy /map route to the new SOC Shell at /
 */
export default function MapRedirect() {
  redirect('/');
}