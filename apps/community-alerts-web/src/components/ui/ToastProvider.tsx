'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Toast } from './Toast';
import type { Incident } from '@/lib/types';

/**
 * ToastProvider
 * Subscribes to the Condition incidents array length.
 * When a new incident arrives, it displays a toast notification.
 */
export function ToastProvider() {
  const incidents = useStore((state) => state.incidents);
  const [lastCount, setLastCount] = useState(0);
  const [activeToast, setActiveToast] = useState<{ id: string; incident: Incident } | null>(null);

  useEffect(() => {
    // Initial load
    if (lastCount === 0 && incidents.length > 0) {
      setLastCount(incidents.length);
      return;
    }

    if (incidents.length > lastCount) {
      // New incident arrived
      const newest = incidents[0]; 
      if (newest) {
        setActiveToast({ id: `${newest.id}-${Date.now()}`, incident: newest });
      }
      setLastCount(incidents.length);
    }
  }, [incidents, lastCount]);

  if (!activeToast) return null;

  return (
    <Toast 
      key={activeToast.id} 
      incident={activeToast.incident} 
      onClose={() => setActiveToast(null)} 
    />
  );
}
