import { Suspense } from 'react';
import { CommandMap } from '@/components/map/CommandMap';
import { TopHUD } from '@/components/layout/TopHUD';
import { AmbientHUD } from '@/components/layout/AmbientHUD';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { LeftPanel } from '@/components/panels/LeftPanel';
import { RightPane } from '@/components/panels/RightPane';
import { ReportModal } from '@/components/alerts/ReportModal';

/**
 * SOC Command Centre — root page.
 *
 * Wrapped in <Suspense> because multiple child components call
 * useSearchParams(), which requires a Suspense boundary in Next.js 14
 * App Router to prevent a static-generation bailout error.
 * The fallback renders the map shell immediately so the page is never blank.
 */
function SOCShell() {
  return (
    <div className="relative w-screen h-screen bg-bg text-text-primary overflow-hidden select-none">
      {/* z-0: Full-bleed map */}
      <CommandMap />

      {/* z-10: Ambient bottom HUD (desktop) */}
      <AmbientHUD />

      {/* z-20: Top HUD */}
      <TopHUD />

      {/* z-30: Left panel — Feed ↔ Analytics */}
      <LeftPanel />

      {/* z-40: Right pane — Incident Brief ↔ Suburb Brief */}
      <RightPane />

      {/* z-50: Report modal */}
      <ReportModal />

      {/* Mobile tab bar (replaces AmbientHUD on small screens) */}
      <MobileTabBar />
    </div>
  );
}

function MapFallback() {
  return (
    <div className="w-screen h-screen bg-[#080a0f] flex items-center justify-center">
      <div className="font-mono text-[11px] text-[#6b7a96] uppercase tracking-widest animate-pulse">
        Initialising command centre…
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<MapFallback />}>
      <SOCShell />
    </Suspense>
  );
}