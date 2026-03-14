'use client';

import { useEffect, useState } from 'react';
import { X, TrendingUp, TrendingDown, Minus, Shield, MapPin, BarChart3 } from 'lucide-react';
import type { StationData, StationCrime } from './StationMap';

interface Props {
  station: StationData;
  rank: number;
  totalStations: number;
  onClose: () => void;
}

function changePill(pct: number) {
  if (pct > 5)  return { Icon: TrendingUp,  color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  label: `+${pct}%` };
  if (pct < -5) return { Icon: TrendingDown, color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  label: `${pct}%`  };
  return         { Icon: Minus,       color: '#eab308', bg: 'rgba(234,179,8,0.12)',   label: `${pct > 0 ? '+' : ''}${pct}%` };
}

const CRIME_PALETTE = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e','#3b82f6'];

function shortenCategory(name: string) {
  return name
    .replace('Assault with the intent to inflict grievous bodily harm', 'GBH Assault')
    .replace('Robbery with aggravating circumstances', 'Aggravated robbery')
    .replace('Theft out of or from motor vehicle', 'Vehicle theft (from)')
    .replace('Theft of motor vehicle and motorcycle', 'Vehicle theft')
    .replace('All theft not mentioned elsewhere', 'Other theft')
    .replace('Burglary at residential premises', 'Residential burglary')
    .replace('Burglary at non-residential premises', 'Non-res. burglary')
    .replace('Robbery at residential premises', 'Residential robbery')
    .replace('Robbery at non-residential premises', 'Non-res. robbery')
    .replace('Malicious damage to property', 'Malicious damage')
    .replace('Drug-related crime', 'Drug crime')
    .replace('Driving under the influence of alcohol or drugs', 'Drunk driving')
    .replace('Illegal possession of firearms and ammunition', 'Illegal firearms')
    .replace('Neglect and ill-treatment of children', 'Child neglect/abuse');
}

function CrimeRow({ crime, max, index }: { crime: StationCrime; max: number; index: number }) {
  const pct = max > 0 ? (crime.count / max) * 100 : 0;
  const diff = crime.count - crime.prev;
  const color = CRIME_PALETTE[index % CRIME_PALETTE.length];
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: '#b0b8cc', flex: 1, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {shortenCategory(crime.category)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 700, color: '#eceef4' }}>
            {crime.count.toLocaleString()}
          </span>
          {diff !== 0 && (
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: diff > 0 ? '#ef4444' : '#22c55e' }}>
              {diff > 0 ? `+${diff}` : diff}
            </span>
          )}
        </div>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: color, transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)', boxShadow: `0 0 6px ${color}60` }} />
      </div>
    </div>
  );
}

export function StationDetailPanel({ station, rank, totalStations, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 20); return () => clearTimeout(t); }, []);

  const pill = changePill(station.change_pct);
  const { Icon: PillIcon } = pill;
  const maxCrime = station.top_crimes.length > 0 ? Math.max(...station.top_crimes.map((c) => c.count)) : 1;
  const rankPct = Math.round(((totalStations - rank + 1) / totalStations) * 100);
  const label = rankPct >= 90 ? 'CRITICAL' : rankPct >= 75 ? 'HIGH' : rankPct >= 50 ? 'ELEVATED' : rankPct >= 25 ? 'MODERATE' : 'LOW';
  const rankColor = label === 'CRITICAL' ? '#ef4444' : label === 'HIGH' ? '#f97316' : label === 'ELEVATED' ? '#eab308' : label === 'MODERATE' ? '#84cc16' : '#22c55e';

  const panelStyle: React.CSSProperties = {
    position: 'absolute', top: 0, right: 0, bottom: 0, width: 320,
    background: 'rgba(10,13,20,0.97)',
    borderLeft: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(16px)',
    zIndex: 1000,
    display: 'flex', flexDirection: 'column',
    transform: visible ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
    overflowY: 'auto',
  };

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Shield size={13} color="#6b7280" />
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.12em' }}>SAPS Station</span>
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: rankColor, background: `${rankColor}18`, border: `1px solid ${rankColor}40`, borderRadius: 4, padding: '1px 5px' }}>{label}</span>
            </div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800, color: '#eceef4', lineHeight: 1.2, marginBottom: 4 }}>
              {station.station}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={10} color="#6b7280" />
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: '#6b7280' }}>{station.district} · {station.province}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '5px 6px', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Q3 2025 Total</div>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 20, fontWeight: 700, color: '#eceef4', lineHeight: 1 }}>{station.total_q3_2025.toLocaleString()}</div>
        </div>
        <div style={{ background: pill.bg, border: `1px solid ${pill.color}30`, borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>vs Q3 2024</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <PillIcon size={14} color={pill.color} />
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 20, fontWeight: 700, color: pill.color, lineHeight: 1 }}>{pill.label}</span>
          </div>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: '#6b7280', marginTop: 4 }}>{station.total_q3_2024.toLocaleString()} previously</div>
        </div>
      </div>

      {/* Rank */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <BarChart3 size={12} color="#6b7280" />
        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: '#6b7280' }}>National rank</span>
        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 700, color: rankColor, marginLeft: 'auto' }}>#{rank} / {totalStations.toLocaleString()}</span>
        <div style={{ width: 64, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ height: '100%', width: `${rankPct}%`, background: rankColor, borderRadius: 2 }} />
        </div>
      </div>

      {/* Crime breakdown */}
      <div style={{ padding: '14px 16px', flex: 1 }}>
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <BarChart3 size={10} color="#6b7280" />
          Top Crime Categories · Q3 2025
        </div>
        {station.top_crimes.length === 0 ? (
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: '#4b5468', textAlign: 'center', paddingTop: 32 }}>No detailed breakdown available</div>
        ) : (
          station.top_crimes.map((crime, i) => (
            <CrimeRow key={crime.category} crime={crime} max={maxCrime} index={i} />
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: '#4b5468', lineHeight: 1.6, margin: 0 }}>
          Source: SAPS Crime Statistics Q3 2025 (Oct–Dec). Figures represent reported incidents per category at this station.
        </p>
      </div>
    </div>
  );
}
