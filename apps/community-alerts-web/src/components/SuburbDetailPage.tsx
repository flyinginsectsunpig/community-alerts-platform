'use client';

import { useStore } from '@/lib/store';
import { TYPE_CONFIG, ALERT_LEVEL_COLOR } from '@/lib/constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Link from 'next/link';
import { ArrowLeft, MapPin, AlertTriangle, TrendingUp, MessageSquare } from 'lucide-react';
import { clsx } from 'clsx';
import { SeverityBar } from '@/components/shared/SeverityBar';
import { SuburbHeatBar } from '@/components/shared/SuburbHeatBar';

export function SuburbDetailPage({ suburbId }: { suburbId: string }) {
  const { suburbs, incidents, forumPosts } = useStore();

  const suburb = suburbs.find((s) => s.id === suburbId);
  const subIncidents = incidents.filter((i) => i.suburb === suburbId);
  const posts = forumPosts[suburbId] ?? [];

  if (!suburb) {
    return (
      <div className="p-8 text-center text-text-dim font-mono text-sm">
        Suburb not found. <Link href="/" className="text-accent hover:underline">Go home</Link>
      </div>
    );
  }

  const color = ALERT_LEVEL_COLOR[suburb.alertLevel ?? 'GREEN'];

  const typeCounts = Object.keys(TYPE_CONFIG).map((t) => ({
    name: TYPE_CONFIG[t as keyof typeof TYPE_CONFIG].label,
    count: subIncidents.filter((i) => i.type === t).length,
    color: TYPE_CONFIG[t as keyof typeof TYPE_CONFIG].color,
  })).filter(t => t.count > 0);

  const recent = [...subIncidents].sort((a, b) => (b.id > a.id ? 1 : -1)).slice(0, 5);

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Back */}
      <Link href="/analytics" className="inline-flex items-center gap-2 font-mono text-[11px] text-text-dim hover:text-accent uppercase tracking-wider transition-colors">
        <ArrowLeft size={11} /> All Suburbs
      </Link>

      {/* Hero */}
      <div className="card p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl" style={{ background: `${color}15` }} />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />
                <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color }}>
                  {suburb.alertLevel ?? 'GREEN'} ALERT
                </span>
              </div>
              <h1 className="font-display font-extrabold text-3xl text-text-primary">{suburb.name}</h1>
              <div className="flex items-center gap-1.5 mt-1 font-mono text-[11px] text-text-dim">
                <MapPin size={10} />
                {suburb.lat.toFixed(4)}, {suburb.lng.toFixed(4)}
              </div>
            </div>

            <div className="text-right">
              <div className="font-display font-extrabold text-5xl" style={{ color }}>{suburb.weight}</div>
              <div className="font-mono text-[11px] text-text-dim uppercase tracking-wider mt-1">Heat Score</div>
              <div className="w-24 mt-2 ml-auto">
                <SuburbHeatBar weight={suburb.weight} alertLevel={suburb.alertLevel} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="stat-value">{subIncidents.length}</div>
          <div className="stat-label">Total Incidents</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-crime">{subIncidents.filter(i => i.type === 'crime').length}</div>
          <div className="stat-label">Crime Reports</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-fire">{subIncidents.filter(i => i.severity === 5).length}</div>
          <div className="stat-label">Critical Events</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-accent">{posts.length}</div>
          <div className="stat-label">Forum Posts</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Type breakdown chart */}
        {typeCounts.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={13} className="text-accent" />
              <span className="font-display font-bold text-sm">Incident Types</span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={typeCounts} barSize={24}>
                <XAxis dataKey="name" tick={{ fill: '#4b5468', fontSize: 10, fontFamily: 'Space Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4b5468', fontSize: 10, fontFamily: 'Space Mono' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ background: '#0e1118', border: '1px solid #222636', borderRadius: 8, fontFamily: 'Space Mono', fontSize: 11 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {typeCounts.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent incidents */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <TrendingUp size={13} className="text-accent" />
            <span className="font-display font-bold text-sm">Recent Incidents</span>
            <Link href={`/alerts`} className="ml-auto font-mono text-[10px] text-accent hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-border">
            {recent.length === 0 ? (
              <div className="py-8 text-center text-text-dim font-mono text-xs">No incidents recorded</div>
            ) : (
              recent.map((incident) => {
                const cfg = TYPE_CONFIG[incident.type];
                return (
                  <div key={incident.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface2 transition-colors">
                    <div className="text-base flex-shrink-0 mt-0.5">{cfg.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-semibold text-sm truncate">{incident.title}</div>
                      <div className="font-mono text-[10px] text-text-dim mt-0.5">{incident.time}</div>
                    </div>
                    <div className="flex gap-0.5 flex-shrink-0 mt-1">
                      <SeverityBar severity={incident.severity} size="sm" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Forum posts */}
      {posts.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <MessageSquare size={13} className="text-accent" />
            <span className="font-display font-bold text-sm">Community Discussion</span>
            <Link href="/forum" className="ml-auto font-mono text-[10px] text-accent hover:underline">Go to forum →</Link>
          </div>
          <div className="divide-y divide-border">
            {posts.slice(0, 3).map((post, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white flex-shrink-0" style={{ background: post.avatar }}>
                  {post.user[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-semibold text-sm">{post.user}</span>
                    <span className="font-mono text-[10px] text-text-dim">{post.time}</span>
                  </div>
                  <p className="font-body text-sm text-text-secondary mt-1 leading-relaxed">{post.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
