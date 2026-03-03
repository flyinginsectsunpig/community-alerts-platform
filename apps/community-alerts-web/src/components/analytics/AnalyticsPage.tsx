'use client';

import { useStore } from '@/lib/store';
import { TYPE_CONFIG, ALERT_LEVEL_COLOR, SEVERITY_COLORS } from '@/lib/constants';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, BarChart3, Activity } from 'lucide-react';
import Link from 'next/link';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-lg p-3 shadow-xl">
      <div className="font-mono text-[10px] text-text-dim mb-2 uppercase tracking-wider">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 font-mono text-xs">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-text-dim">{p.name}:</span>
          <span className="text-text-primary font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export function AnalyticsPage() {
  const { incidents, suburbs } = useStore();

  // Type breakdown
  const typeCounts = Object.keys(TYPE_CONFIG).map((type) => ({
    name: TYPE_CONFIG[type as keyof typeof TYPE_CONFIG].label,
    value: incidents.filter((i) => i.type === type).length,
    color: TYPE_CONFIG[type as keyof typeof TYPE_CONFIG].color,
    icon: TYPE_CONFIG[type as keyof typeof TYPE_CONFIG].emoji,
  }));

  // Suburb ranking
  const suburbRanking = [...suburbs]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8)
    .map((s) => ({
      name: s.name.replace(' (CT)', '').slice(0, 12),
      score: s.weight,
      incidents: incidents.filter((i) => i.suburb === s.id).length,
      level: s.alertLevel ?? 'GREEN',
    }));

  // Severity distribution
  const severityData = [1,2,3,4,5].map((sev) => ({
    name: `Sev ${sev}`,
    count: incidents.filter((i) => i.severity === sev).length,
    color: SEVERITY_COLORS[sev],
  }));

  // Radar data by suburb (top 6)
  const radarData = Object.keys(TYPE_CONFIG).map((type) => ({
    subject: TYPE_CONFIG[type as keyof typeof TYPE_CONFIG].label,
    count: incidents.filter((i) => i.type === type).length,
  }));

  const totalAlerts = incidents.length;
  const crimeRatio = totalAlerts > 0 ? ((incidents.filter(i => i.type === 'crime').length / totalAlerts) * 100).toFixed(0) : 0;
  const criticalCount = incidents.filter(i => i.severity === 5).length;
  const avgSeverity = totalAlerts > 0
    ? (incidents.reduce((s, i) => s + i.severity, 0) / totalAlerts).toFixed(1)
    : '0';

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div>
        <div className="badge-mono mb-2">Analytics & Intelligence</div>
        <h1 className="font-display font-extrabold text-2xl text-text-primary">
          Safety <span className="text-accent">Analytics</span>
        </h1>
        <p className="text-text-dim font-body text-sm mt-1">Incident patterns, suburb rankings, and threat analysis.</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Incidents', value: totalAlerts, sub: 'All time' },
          { label: 'Crime Rate', value: `${crimeRatio}%`, sub: 'Of all alerts', color: '#ef4444' },
          { label: 'Avg Severity', value: avgSeverity, sub: 'Out of 5', color: '#f97316' },
          { label: 'Critical Events', value: criticalCount, sub: 'Severity 5', color: '#f43f5e' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-value" style={color ? { color } : undefined}>{value}</div>
            <div className="stat-label">{label}</div>
            <div className="font-mono text-[9px] text-text-dim mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Suburb heat ranking */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={14} className="text-accent" />
            <h2 className="font-display font-bold text-sm">Suburb Heat Ranking</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={suburbRanking} layout="vertical" barSize={14}>
              <XAxis type="number" tick={{ fill: '#4b5468', fontSize: 10, fontFamily: 'Space Mono' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#8891a8', fontSize: 10, fontFamily: 'Space Mono' }} axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {suburbRanking.map((entry, i) => (
                  <Cell key={i} fill={ALERT_LEVEL_COLOR[entry.level]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Type breakdown */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={14} className="text-accent" />
            <h2 className="font-display font-bold text-sm">Incident Type Distribution</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={typeCounts.filter(t => t.value > 0)}
                dataKey="value"
                nameKey="name"
                cx="50%" cy="50%"
                innerRadius={55} outerRadius={90}
                paddingAngle={3}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {typeCounts.filter(t => t.value > 0).map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Severity distribution */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-accent" />
            <h2 className="font-display font-bold text-sm">Severity Distribution</h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={severityData} barSize={32}>
              <XAxis dataKey="name" tick={{ fill: '#4b5468', fontSize: 10, fontFamily: 'Space Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4b5468', fontSize: 10, fontFamily: 'Space Mono' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {severityData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Incident radar */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={14} className="text-accent" />
            <h2 className="font-display font-bold text-sm">Threat Profile Radar</h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#222636" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#8891a8', fontSize: 10, fontFamily: 'Space Mono' }} />
              <Radar name="Incidents" dataKey="count" stroke="#f97316" fill="#f97316" fillOpacity={0.18} />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Suburb detail cards */}
      <div>
        <h2 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
          <span className="text-accent">▸</span> Suburb Detail
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {suburbs.map((suburb) => {
            const subIncidents = incidents.filter((i) => i.suburb === suburb.id);
            const color = ALERT_LEVEL_COLOR[suburb.alertLevel ?? 'GREEN'];
            const pct = Math.min(100, (suburb.weight / 50) * 100);

            return (
              <Link
                key={suburb.id}
                href={`/suburb/${suburb.id}`}
                className="card-hover p-3 group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="font-display font-bold text-sm truncate group-hover:text-accent transition-colors">{suburb.name}</span>
                </div>
                <div className="font-mono text-lg font-bold" style={{ color }}>{suburb.weight}</div>
                <div className="font-mono text-[10px] text-text-dim mb-2">Heat score</div>
                <div className="heat-bar">
                  <div className="heat-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
                <div className="font-mono text-[10px] text-text-dim mt-1.5">
                  {subIncidents.length} incident{subIncidents.length !== 1 ? 's' : ''}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
