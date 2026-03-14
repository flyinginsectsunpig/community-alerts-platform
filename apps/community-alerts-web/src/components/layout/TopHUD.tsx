'use client';

import { Shield, Radio, ShieldAlert } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useRouter } from 'next/navigation';

/**
 * TopHUD Component
 * Replaces the traditional Navbar. Fixed at the top (48px).
 * Contains Logo, System Status dots, and Report button.
 */
export function TopHUD() {
  const router = useRouter();
  const { backendConnected, mlConnected, notificationConnected } = useStore();

  const getStatusColor = (connected: boolean) => {
    return connected ? 'bg-green' : 'bg-red';
  };

  const getStatusVars = (connected: boolean) => {
    return { '--dot-color': connected ? '34, 197, 94' : '239, 68, 68' } as React.CSSProperties;
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-12 bg-surface/92 border-b border-border z-20 px-4 flex items-center justify-between">
      {/* Left: Logo */}
      <div 
        className="flex items-center gap-2 cursor-pointer group"
        onClick={() => router.push('/')}
      >
        <div className="relative">
          <Shield className="text-accent w-6 h-6 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
          <div className="absolute inset-0 bg-accent/20 blur-lg rounded-full animate-pulse-slow" />
        </div>
        <span className="font-display font-bold text-lg tracking-tight text-text-primary hidden sm:block">
          COMMUNITY<span className="text-accent">ALERTS</span>
        </span>
      </div>

      {/* Centre: System Status (Desktop) */}
      <div className="hidden md:flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div 
            className={`w-1.5 h-1.5 rounded-full ${getStatusColor(backendConnected)} animate-dot-pulse`} 
            style={getStatusVars(backendConnected)}
          />
          <span className="font-mono text-[9px] uppercase tracking-widest text-text-dim">Java API</span>
        </div>
        <div className="flex items-center gap-2">
          <div 
            className={`w-1.5 h-1.5 rounded-full ${getStatusColor(mlConnected)} animate-dot-pulse`} 
            style={getStatusVars(mlConnected)}
          />
          <span className="font-mono text-[9px] uppercase tracking-widest text-text-dim">ML Service</span>
        </div>
        <div className="flex items-center gap-2">
          <div 
            className={`w-1.5 h-1.5 rounded-full ${getStatusColor(notificationConnected)} animate-dot-pulse`} 
            style={getStatusVars(notificationConnected)}
          />
          <span className="font-mono text-[9px] uppercase tracking-widest text-text-dim">Notifications</span>
        </div>
      </div>

      {/* Right: Report Button */}
      <button 
        onClick={() => router.push('/?report=true')}
        className="px-4 py-1.5 bg-accent hover:bg-orange-500 text-white rounded-md font-display font-bold text-xs transition-all shadow-[0_0_15px_rgba(249,115,22,0.3)] hover:shadow-[0_0_20px_rgba(249,115,22,0.5)] active:scale-95 flex items-center gap-2"
      >
        <ShieldAlert size={14} />
        <span className="hidden xs:inline">REPORT INCIDENT</span>
        <span className="xs:hidden">REPORT</span>
      </button>
    </header>
  );
}
