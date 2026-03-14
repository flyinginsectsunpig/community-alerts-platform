'use client';

/**
 * StationMapView — full-page wrapper that wires StationMap + StationDetailPanel.
 *
 * Drop-in replacement for MapView on the /map route, or embed anywhere.
 * Supports a province filter strip and a search box.
 */

import dynamic from 'next/dynamic';
import { useState, useEffect, useMemo } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { StationDetailPanel } from './StationDetailPanel';
import type { StationData } from './StationMap';

const StationMap = dynamic(() => import('./StationMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-bg flex items-center justify-center">
      <div className="text-text-dim font-mono text-sm animate-pulse">Loading station map…</div>
    </div>
  ),
});

const PROVINCES = [
  'All Provinces',
  'Western Cape',
  'Gauteng',
  'KwaZulu-Natal',
  'Eastern Cape',
  'Limpopo',
  'Mpumalanga',
  'Free State',
  'North West',
  'Northern Cape',
];

export function StationMapView() {
  const [allStations, setAllStations] = useState<StationData[]>([]);
  const [selectedStation, setSelectedStation] = useState<StationData | null>(null);
  const [province, setProvince] = useState('All Provinces');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<StationData[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    fetch('/stations_data.json')
      .then((r) => r.json())
      .then((data: StationData[]) => setAllStations(data));
  }, []);

  // Sorted rank lookup
  const rankedStations = useMemo(
    () => [...allStations].sort((a, b) => b.total_q3_2025 - a.total_q3_2025),
    [allStations],
  );

  const getRank = (station: StationData) =>
    rankedStations.findIndex((s) => s.station === station.station) + 1;

  // Live search
  useEffect(() => {
    if (search.trim().length < 2) { setSearchResults([]); return; }
    const q = search.toLowerCase();
    setSearchResults(
      allStations
        .filter(
          (s) =>
            s.station.toLowerCase().includes(q) ||
            s.district.toLowerCase().includes(q) ||
            s.province.toLowerCase().includes(q),
        )
        .slice(0, 8),
    );
  }, [search, allStations]);

  const handleSelectStation = (s: StationData | null) => {
    setSelectedStation(s);
    setSearch('');
    setSearchResults([]);
    setShowSearch(false);
  };

  // Province summary stats
  const provinceSummary = useMemo(() => {
    const filtered = province === 'All Provinces' ? allStations : allStations.filter((s) => s.province === province);
    const total = filtered.reduce((sum, s) => sum + s.total_q3_2025, 0);
    const stations = filtered.length;
    const topStation = [...filtered].sort((a, b) => b.total_q3_2025 - a.total_q3_2025)[0];
    return { total, stations, topStation };
  }, [allStations, province]);

  return (
    <div className="flex flex-col h-full">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b border-border bg-surface"
        style={{ minHeight: 48, flexWrap: 'wrap' }}
      >
        {/* Province filter */}
        <div className="relative">
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="appearance-none bg-surface2 border border-border rounded-lg px-3 pr-7 py-1.5 font-mono text-xs text-text-secondary cursor-pointer hover:border-accent/40 transition-colors focus:outline-none focus:border-accent/60"
          >
            {PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none" />
        </div>

        {/* Province quick stats */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-text-dim uppercase tracking-wider">Stations</span>
            <span className="font-mono text-xs font-bold text-text-primary">{provinceSummary.stations.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-text-dim uppercase tracking-wider">Q3 2025 Incidents</span>
            <span className="font-mono text-xs font-bold text-text-primary">{provinceSummary.total.toLocaleString()}</span>
          </div>
          {provinceSummary.topStation && (
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-text-dim uppercase tracking-wider">Highest</span>
              <button
                onClick={() => handleSelectStation(provinceSummary.topStation!)}
                className="font-mono text-xs font-bold text-accent hover:underline truncate max-w-[120px]"
              >
                {provinceSummary.topStation.station}
              </button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="btn-ghost text-xs flex items-center gap-1.5"
          >
            <Search size={12} />
            <span className="hidden sm:inline">Search station</span>
          </button>

          {showSearch && (
            <div
              className="absolute right-0 top-full mt-1 z-50 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden"
              style={{ width: 280 }}
            >
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <Search size={12} className="text-text-dim flex-shrink-0" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Station name, district…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent font-mono text-xs text-text-primary placeholder:text-text-dim focus:outline-none"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-text-dim hover:text-text-primary">
                    <X size={10} />
                  </button>
                )}
              </div>
              <div>
                {searchResults.length === 0 && search.length >= 2 && (
                  <div className="px-3 py-4 font-mono text-xs text-text-dim text-center">No stations found</div>
                )}
                {searchResults.map((s) => (
                  <button
                    key={s.station}
                    onClick={() => handleSelectStation(s)}
                    className="w-full text-left px-3 py-2.5 hover:bg-surface2 transition-colors border-b border-border/50 last:border-0"
                  >
                    <div className="font-mono text-xs font-bold text-text-primary">{s.station}</div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="font-mono text-[9px] text-text-dim">{s.district}</span>
                      <span className="font-mono text-[9px] text-text-dim">{s.total_q3_2025.toLocaleString()} incidents</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Map + panel ──────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        <StationMap
          onSelectStation={handleSelectStation}
          selectedStation={selectedStation}
        />

        {selectedStation && (
          <StationDetailPanel
            station={selectedStation}
            rank={getRank(selectedStation)}
            totalStations={allStations.length}
            onClose={() => setSelectedStation(null)}
          />
        )}
      </div>
    </div>
  );
}
