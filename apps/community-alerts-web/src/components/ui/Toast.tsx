'use client';

import { useEffect, useState } from 'react';
import { TYPE_CONFIG, SEVERITY_COLORS } from '@/lib/constants';
import type { Incident } from '@/lib/types';
import { X } from 'lucide-react';

/**
 * Toast Component
 * Displays a single short-lived notification when a new incident arrives.
 */
export function Toast({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const [closing, setClosing] = useState(false);
  const isCritical = incident.severity === 5;
  const config = TYPE_CONFIG[incident.type];

  // Auto-dismiss except for Critical
  useEffect(() => {
    if (isCritical) return;
    const timer = setTimeout(() => {
      handleClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [isCritical]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 300); // Wait for transition out
  };

  return (
    <div
      className={`
        fixed top-4 right-4 z-50 flex items-center gap-3 p-3 max-w-[320px] shadow-glow-orange
        bg-surface/92 backdrop-blur-sm border-t border-r border-b border-border rounded-lg
        transition-all duration-300 transform
        md:top-6 md:right-6 md:translate-x-0
        bottom-auto md:max-w-[400px] left-1/2 -translate-x-1/2 md:-translate-x-0 md:left-auto
        ${closing ? 'opacity-0 translate-y-[-20px] md:translate-x-[20px] md:translate-y-0' : 'animate-fade-in'}
      `}
      style={{
        borderLeft: `4px solid ${isCritical ? '#ef4444' : SEVERITY_COLORS[incident.severity]}`,
        ...(isCritical ? { borderColor: '#ef4444' } : {})
      }}
    >
      <div className="flex items-center justify-center text-2xl">
        {config?.emoji || '⚠️'}
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="font-display font-bold text-sm text-text-primary leading-tight truncate">
          {incident.title}
        </h4>
        <div className="font-mono text-[10px] text-text-secondary mt-1 tracking-wider uppercase">
          {incident.suburb}
        </div>
      </div>

      <button
        onClick={handleClose}
        className="p-1 rounded opacity-50 hover:opacity-100 hover:bg-surface2 transition-all"
        aria-label="Close"
      >
        <X size={16} />
      </button>
    </div>
  );
}
