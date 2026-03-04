'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, Map, Bell, BarChart3, MessageSquare, Plus, Rss, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '@/lib/store';
import { ReportModal } from '@/components/alerts/ReportModal';
import { useState } from 'react';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard', icon: Rss },
  { href: '/map', label: 'Live Map', icon: Map },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/forum', label: 'Forum', icon: MessageSquare },
  { href: '/admin', label: 'Admin', icon: Settings },
];

export function Navbar() {
  const pathname = usePathname();
  const { incidents, backendConnected, mlConnected } = useStore();
  const [reportOpen, setReportOpen] = useState(false);

  const criticalCount = incidents.filter((i) => i.severity === 5 && i.type === 'crime').length;

  return (
    <>
      <nav className="flex-shrink-0 h-14 bg-surface border-b border-border flex items-center px-4 gap-4 z-50">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-glow-orange group-hover:shadow-[0_0_16px_rgba(249,115,22,0.5)] transition-shadow">
            <Shield size={16} className="text-white" />
          </div>
          <span className="font-display font-extrabold text-base leading-none">
            Community<span className="text-accent">Alerts</span>
          </span>
        </Link>

        <div className="w-px h-6 bg-border flex-shrink-0" />

        {/* Nav links */}
        <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-hide">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-display font-semibold text-sm transition-all whitespace-nowrap',
                  active
                    ? 'bg-accent/10 text-accent border border-accent/20'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface2',
                )}
              >
                <Icon size={14} />
                {label}
                {href === '/alerts' && criticalCount > 0 && (
                  <span className="ml-0.5 w-4 h-4 rounded-full bg-red text-white text-[9px] font-mono flex items-center justify-center">
                    {criticalCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface2 border border-border">
            <span className={clsx('w-1.5 h-1.5 rounded-full', backendConnected ? 'bg-green animate-pulse' : 'bg-red')} />
            <span className="font-mono text-[10px] text-text-dim uppercase">Live</span>
          </div>

          <button
            onClick={() => setReportOpen(true)}
            className="btn-primary text-xs px-3 py-1.5 gap-1.5"
          >
            <Plus size={13} />
            Report
          </button>
        </div>
      </nav>

      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} />
    </>
  );
}
