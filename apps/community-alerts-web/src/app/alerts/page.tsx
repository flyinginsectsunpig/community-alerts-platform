import { redirect } from 'next/navigation';

/**
 * Redirects legacy /alerts route to the new SOC Shell at /
 */
export default function AlertsRedirect() {
  redirect('/');
}