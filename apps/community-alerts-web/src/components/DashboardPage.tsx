'use client';

import { useStore } from '@/lib/store';
import { TYPE_CONFIG, ALERT_LEVEL_COLOR } from '@/lib/constants';
import { clsx } from 'clsx';
import Link from 'next/link';
import { ArrowRight, TrendingUp, AlertTriangle, MapPin, Activity, Users } from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { SuburbHeatBar } from '@/components/shared/SuburbHeatBar';


function IncidentRow({ incident, suburbName }: { incident: any; suburbName: string }) {
  const cfg = TYPE_CONFIG[incident.type as keyof typeof TYPE_CONFIG];
  return (
    <Link
      href={`/alerts?id=${incident.id}`}
      className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface2 transition-colors group"
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm border"
        style={{ background: `${cfg.color}18`, borderColor: `${cfg.color}33` }}
      >
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-semibold text-sm text-text-primary truncate group-hover:text-accent transition-colors">
          {incident.title}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-mono text-[10px] text-text-dim">{suburbName}</span>
          <span className="text-border">·</span>
          <span className="font-mono text-[10px] text-text-dim">{incident.time}</span>
          {incident.severity >= 4 && (
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-red/10 text-red border border-red/20">
              CRITICAL
            </span>
          )}
        </div>
      </div>
      <ArrowRight size={12} className="text-text-dim opacity-0 group-hover:opacity-100 mt-1 transition-opacity flex-shrink-0" />
    </Link>
  );
}

function SuburbHeatRow({ suburb }: { suburb: any }) {
  const color = ALERT_LEVEL_COLOR[suburb.alertLevel ?? 'GREEN'];
  return (
    <Link href={`/suburb/${suburb.id}`} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-surface2 transition-colors group">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="font-body text-sm text-text-secondary flex-1 group-hover:text-text-primary transition-colors truncate">{suburb.name}</span>
      <div className="w-20">
        <SuburbHeatBar weight={suburb.weight} alertLevel={suburb.alertLevel} />
      </div>
      <span className="font-mono text-[10px] text-text-dim w-6 text-right">{suburb.weight}</span>
    </Link>
  );
}

export function DashboardPage() {
  const { incidents, suburbs } = useStore();

  const totalAlerts = incidents.length;
  const crimeAlerts = incidents.filter((i) => i.type === 'crime').length;
  const criticalAlerts = incidents.filter((i) => i.severity === 5).length;
  const activeSuburbs = suburbs.filter((s) => s.weight > 10).length;

  const recent = [...incidents].sort((a, b) => (b.id > a.id ? 1 : -1)).slice(0, 8);
  const topSuburbs = [...suburbs].sort((a, b) => b.weight - a.weight).slice(0, 8);

  const typeCounts = incidents.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

      {/* Hero header */}
      <div className="relative rounded-2xl overflow-hidden border border-border bg-surface p-6">
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="badge-mono mb-3">Real-time Safety Intelligence</div>
            <h1 className="font-display font-extrabold text-3xl text-text-primary leading-tight">
              Cape Town <span className="text-accent">Community</span> Dashboard
            </h1>
            <p className="text-text-secondary font-body text-sm mt-2 max-w-lg">
              Live incident tracking, ML-powered threat analysis, and community-driven safety alerts across all Cape Town suburbs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="live-dot" />
            <span className="font-mono text-xs text-text-secondary uppercase tracking-wider">Live Updates</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard value={totalAlerts} label="Active Alerts" sub="All incident types" color="#eceef4" />
        <StatCard value={crimeAlerts} label="Crime Incidents" sub="Last 24h" color="#ef4444" />
        <StatCard value={criticalAlerts} label="Critical (Sev 5)" sub="Immediate response" color="#f43f5e" />
        <StatCard value={activeSuburbs} label="Elevated Areas" sub="Heat score > 10" color="#f97316" />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent alerts */}
        <div className="lg:col-span-2 card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-accent" />
              <span className="font-display font-bold text-sm">Recent Alerts</span>
            </div>
            <Link href="/alerts" className="font-mono text-[10px] text-accent uppercase tracking-wider flex items-center gap-1 hover:underline">
              View all <ArrowRight size={10} />
            </Link>
          </div>
          <div className="p-2">
            {recent.map((incident) => {
              const suburb = suburbs.find((s) => s.id === incident.suburb);
              return (
                <IncidentRow key={incident.id} incident={incident} suburbName={suburb?.name ?? 'Unknown'} />
              );
            })}
            {recent.length === 0 && (
              <div className="text-center py-8 text-text-dim font-mono text-xs">No incidents reported</div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* Suburb heat index */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-accent" />
                <span className="font-display font-bold text-sm">Suburb Heat Index</span>
              </div>
              <Link href="/analytics" className="font-mono text-[10px] text-accent uppercase tracking-wider flex items-center gap-1 hover:underline">
                Full map <ArrowRight size={10} />
              </Link>
            </div>
            <div className="px-2 py-2">
              {topSuburbs.map((suburb) => (
                <SuburbHeatRow key={suburb.id} suburb={suburb} />
              ))}
            </div>
          </div>

          {/* Incident breakdown */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={13} className="text-accent" />
              <span className="font-display font-bold text-sm">Incident Breakdown</span>
            </div>
            <div className="space-y-2.5">
              {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
                const count = typeCounts[type] || 0;
                const pct = totalAlerts > 0 ? (count / totalAlerts) * 100 : 0;
                return (
                  <div key={type} className="flex items-center gap-2">
                    <span className="text-sm w-4">{cfg.icon}</span>
                    <span className="font-body text-xs text-text-secondary flex-1">{cfg.label}</span>
                    <div className="w-16 h-1 rounded-full bg-border overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cfg.color }} />
                    </div>
                    <span className="font-mono text-[10px] text-text-dim w-4 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/map" className="card-hover p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue/10 border border-blue/20 flex items-center justify-center">
            <span className="text-lg">🗺️</span>
          </div>
          <div>
            <div className="font-display font-bold text-sm">Live Map</div>
            <div className="font-body text-xs text-text-dim">View all incidents on map</div>
          </div>
          <ArrowRight size={14} className="ml-auto text-text-dim" />
        </Link>
        <Link href="/analytics" className="card-hover p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <TrendingUp size={18} className="text-accent" />
          </div>
          <div>
            <div className="font-display font-bold text-sm">Analytics</div>
            <div className="font-body text-xs text-text-dim">Trends, patterns, forecasts</div>
          </div>
          <ArrowRight size={14} className="ml-auto text-text-dim" />
        </Link>
        <Link href="/forum" className="card-hover p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple/10 border border-purple/20 flex items-center justify-center">
            <Users size={18} className="text-purple" />
          </div>
          <div>
            <div className="font-display font-bold text-sm">Community Forum</div>
            <div className="font-body text-xs text-text-dim">Suburb discussions</div>
          </div>
          <ArrowRight size={14} className="ml-auto text-text-dim" />
        </Link>
      </div>

    </div>
  );
}
