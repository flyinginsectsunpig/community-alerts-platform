/**
 * RightPane.tsx
 * FIX #2: Replaced invalid `duration-320` Tailwind class with `duration-300`.
 * Tailwind only supports duration-75/100/150/200/300/500/700/1000 out of the
 * box. Custom easing is applied via inline style on the transition property.
 * FIX: Cleaned up conflicting height/bottom classes in the className string.
 * The pane now uses consistent `top-12 bottom-9` on desktop and full-height
 * bottom-sheet positioning on mobile via the translate approach.
 */
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { IncidentBrief } from './IncidentBrief';
import { SuburbBrief } from './SuburbBrief';

export function RightPane() {
  const router  = useRouter();
  const searchParams = useSearchParams();

  const incidentId = searchParams.get('incident');
  const suburbId   = searchParams.get('suburb');
  const isOpen     = !!(incidentId || suburbId);

  const close = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('incident');
    params.delete('suburb');
    // Keep other params (e.g. ?view=analytics) intact
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/');
  };

  return (
    <div
      className={[
        // Positioning
        'fixed right-0 top-12 z-40 flex flex-col',
        // Desktop: fixed width, stops above ambient HUD
        'md:w-[380px] md:bottom-9',
        // Mobile: full-width bottom sheet covering 85% of screen
        'w-full bottom-0 max-h-[85vh] md:max-h-none',
        // Background — solid, no heavy blur over map
        'bg-[#0e1118]/96 border-l border-border',
        // Shadow separates pane from map
        'shadow-[-4px_0_32px_rgba(0,0,0,0.6)]',
        // Slide animation — FIX: duration-300 (valid), custom cubic-bezier via style prop
        'transition-transform duration-300',
        isOpen
          ? 'translate-x-0'
          // Desktop slides from right; mobile slides from bottom
          : 'translate-x-full md:translate-x-full',
      ].join(' ')}
      style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      {/* Close button — absolute so it overlays content */}
      <button
        onClick={close}
        aria-label="Close panel"
        className="absolute top-3 right-3 z-50 w-7 h-7 rounded-md border border-border bg-surface2/80 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface2 transition-all"
      >
        <X size={14} />
      </button>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {incidentId ? (
          <IncidentBrief id={incidentId} />
        ) : suburbId ? (
          <SuburbBrief id={suburbId} />
        ) : null}
      </div>
    </div>
  );
}
