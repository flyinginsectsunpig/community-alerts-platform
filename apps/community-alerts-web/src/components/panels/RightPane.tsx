'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { IncidentBrief } from './IncidentBrief';
import { SuburbBrief } from './SuburbBrief';

/**
 * RightPane Component
 * Slide-in container (z-40) for Incident or Suburb details.
 */
export function RightPane() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const incidentId = searchParams.get('incident');
  const suburbId = searchParams.get('suburb');
  const isOpen = !!(incidentId || suburbId);

  const close = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('incident');
    params.delete('suburb');
    router.push(`/?${params.toString()}`);
  };

  return (
    <div 
      className={`
        fixed right-0 top-12 bottom-9 w-[380px] bg-surface/96 border-l border-border z-40 flex flex-col
        transition-transform duration-320 ease-out shadow-2xl
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        max-h-[calc(100vh-48px-36px)] bottom-0 md:bottom-9 h-full
        w-full md:w-[380px]
      `}
    >
      <div className="flex-1 overflow-y-auto flex flex-col">
        {incidentId ? (
          <IncidentBrief id={incidentId} />
        ) : suburbId ? (
          <SuburbBrief id={suburbId} />
        ) : null}
      </div>

      <button 
        onClick={close}
        className="absolute top-4 right-4 p-2 bg-surface2/50 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface2 transition-all z-50"
      >
        <X size={18} />
      </button>
    </div>
  );
}
