'use client';

/**
 * SapsStatsPanel — replaces the old AnalyticsPanel numbers.
 *
 * Loads from /saps_summary.json (pre-processed from SAPS Q3 2025 XLSX).
 * Shows real national totals, province breakdown, and top crime categories.
 */

import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import Link from 'next/link';

interface ProvinceStat {
  province: string;
  q3_2025: number;
  q3_2024: number;
  change_pct: number;
}

interface CategoryStat {
  category: string;
  q3_2025: number;
  q3_2024: number;
  change_pct: number;
}

interface TopStation {
  station: string;
  province: string;
  total: number;
  change_pct: number;
}

interface SapsSummary {
  total_q3_2025: number;
  total_q3_2024: number;
  change_pct: number;
  total_stations: number;
  provinces: ProvinceStat[];
  top_categories: CategoryStat[];
  top_stations: TopStation[];
}

function DeltaBadge({ pct }: { pct: number }) {
  if (pct > 5)  return <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 2 }}><TrendingUp size={9} />+{pct}%</span>;
  if (pct < -5) return <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 2 }}><TrendingDown size={9} />{pct}%</span>;
  return <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: '#eab308', display: 'flex', alignItems: 'center', gap: 2 }}><Minus size={9} />{pct > 0 ? '+' : ''}{pct}%</span>;
}

const PROVINCE_COLORS: Record<string, string> = {
  'Gauteng': '#ef4444',
  'Western Cape': '#f97316',
  'KwaZulu-Natal': '#eab308',
  'Eastern Cape': '#84cc16',
  'North West': '#22c55e',
  'Limpopo': '#3b82f6',
  'Free State': '#a855f7',
  'Mpumalanga': '#ec4899',
  'Northern Cape': '#06b6d4',
};

const CATEGORY_COLORS = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e','#3b82f6','#a855f7','#ec4899','#06b6d4','#f59e0b','#10b981','#6366f1','#f43f5e','#14b8a6','#8b5cf6'];

function shortenCat(name: string) {
  return name
    .replace('Assault with the intent to inflict grievous bodily harm', 'GBH Assault')
    .replace('Robbery with aggravating circumstances', 'Aggravated robbery')
    .replace('All theft not mentioned elsewhere', 'Other theft')
    .replace('Burglary at residential premises', 'Residential burglary')
    .replace('Malicious damage to property', 'Malicious damage')
    .replace('Drug-related crime', 'Drug crime')
    .replace('Driving under the influence of alcohol or drugs', 'Drunk driving')
    .replace('Illegal possession of firearms and ammunition', 'Illegal firearms')
    .replace('Theft out of or from motor vehicle', 'Vehicle theft (from)')
    .replace('Theft of motor vehicle and motorcycle', 'Vehicle theft')
    .replace('Robbery at residential premises', 'Residential robbery')
    .replace('Robbery at non-residential premises', 'Non-res. robbery');
}

export function SapsStatsPanel() {
  const [data, setData] = useState<SapsSummary | null>(null);
  const [tab, setTab] = useState<'provinces' | 'categories' | 'stations'>('provinces');

  useEffect(() => {
    fetch('/saps_summary.json')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="flex flex-col p-4 gap-4 animate-fade-in">
        <div className="font-mono text-[10px] text-text-dim text-center py-8 animate-pulse">Loading SAPS statistics…</div>
      </div>
    );
  }

  const maxProv = Math.max(...data.provinces.map((p) => p.q3_2025));
  const maxCat = data.top_categories.length > 0 ? data.top_categories[0].q3_2025 : 1;

  return (
    <div className="flex flex-col p-4 gap-5 animate-fade-in">

      {/* Header */}
      <div>
        <div className="font-mono text-[9px] text-text-dim uppercase tracking-widest mb-1">SAPS Crime Statistics</div>
        <div className="font-display font-extrabold text-lg text-text-primary leading-tight">Q3 2025 National Report</div>
        <div className="font-mono text-[9px] text-text-dim mt-0.5">October – December 2025</div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 bg-surface border border-border rounded-lg">
          <div className="font-mono text-[9px] text-text-dim uppercase tracking-widest">Total Incidents</div>
          <div className="font-mono text-xl font-bold text-text-primary mt-1">{data.total_q3_2025.toLocaleString()}</div>
          <div className="mt-1"><DeltaBadge pct={data.change_pct} /></div>
        </div>
        <div className="p-3 bg-surface border border-border rounded-lg">
          <div className="font-mono text-[9px] text-text-dim uppercase tracking-widest">SAPS Stations</div>
          <div className="font-mono text-xl font-bold text-text-primary mt-1">{data.total_stations.toLocaleString()}</div>
          <div className="font-mono text-[9px] text-text-dim mt-1">nationally active</div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-0.5 bg-surface2 rounded-lg">
        {(['provinces', 'categories', 'stations'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-1.5 rounded-md font-mono text-[9px] uppercase tracking-wider transition-all"
            style={{
              background: tab === t ? 'rgba(255,255,255,0.07)' : 'transparent',
              color: tab === t ? '#eceef4' : '#6b7280',
              border: tab === t ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
            }}
          >
            {t === 'provinces' ? 'Provinces' : t === 'categories' ? 'Crimes' : 'Stations'}
          </button>
        ))}
      </div>

      {/* Province breakdown */}
      {tab === 'provinces' && (
        <div className="flex flex-col gap-2">
          {data.provinces.map((prov) => {
            const color = PROVINCE_COLORS[prov.province] ?? '#6b7280';
            const barPct = maxProv > 0 ? (prov.q3_2025 / maxProv) * 100 : 0;
            return (
              <div key={prov.province}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span className="font-body text-xs text-text-secondary truncate" style={{ maxWidth: 110 }}>{prov.province}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-text-primary">{prov.q3_2025.toLocaleString()}</span>
                    <DeltaBadge pct={prov.change_pct} />
                  </div>
                </div>
                <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${barPct}%`, background: color, borderRadius: 2, transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Crime categories */}
      {tab === 'categories' && (
        <div className="flex flex-col gap-2">
          {data.top_categories.slice(0, 12).map((cat, i) => {
            const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
            const barPct = maxCat > 0 ? (cat.q3_2025 / maxCat) * 100 : 0;
            return (
              <div key={cat.category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-body text-xs text-text-secondary truncate" style={{ maxWidth: 130 }}>{shortenCat(cat.category)}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-text-primary">{cat.q3_2025.toLocaleString()}</span>
                    <DeltaBadge pct={cat.change_pct} />
                  </div>
                </div>
                <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${barPct}%`, background: color, borderRadius: 2, transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Top stations */}
      {tab === 'stations' && (
        <div className="flex flex-col gap-1.5">
          {data.top_stations.slice(0, 15).map((s, i) => (
            <div key={s.station} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface2 transition-colors">
              <span className="font-mono text-[9px] text-text-dim w-4 text-right flex-shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="font-body text-xs text-text-secondary truncate">{s.station}</div>
                <div className="font-mono text-[9px] text-text-dim truncate">{s.province}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-mono text-xs font-bold text-text-primary">{s.total.toLocaleString()}</span>
                <DeltaBadge pct={s.change_pct} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Map link */}
      <Link
        href="/map"
        className="mt-1 w-full py-2.5 bg-surface2 hover:bg-border border border-border rounded-lg font-display font-bold text-[10px] text-text-secondary hover:text-accent transition-all uppercase tracking-[0.2em] text-center block"
      >
        🗺 View Station Map
      </Link>
    </div>
  );
}
