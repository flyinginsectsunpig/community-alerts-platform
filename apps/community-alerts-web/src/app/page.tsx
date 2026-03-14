'use client';

import { CommandMap } from '@/components/map/CommandMap';
import { TopHUD } from '@/components/layout/TopHUD';
import { AmbientHUD } from '@/components/layout/AmbientHUD';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { LeftPanel } from '@/components/panels/LeftPanel';
import { RightPane } from '@/components/panels/RightPane';
import { ReportModal } from '@/components/alerts/ReportModal';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * SOC Command Centre
 * The unified root page for the Community Alerts Platform.
 * Features a full-bleed map background with overlaid panels controlled by URL params.
 */
export default function SOCShell() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Clear params if clicking empty space (handled in CommandMap, but can be central)
  
  return (
    <div className="relative w-screen h-screen bg-bg text-text-primary overflow-hidden select-none">
      {/* z-0: The Foundation */}
      <CommandMap />

      {/* z-10: Ambient Bottom HUD (Desktop) */}
      <AmbientHUD />
      
      {/* Mobile Tab Bar (Mobile) */}
      <MobileTabBar />

      {/* z-20: Top Navigation HUD */}
      <TopHUD />

      {/* z-30: Intelligence Feed (Left) */}
      <LeftPanel />

      {/* z-40: Operational Brief (Right) */}
      <RightPane />

      {/* z-50: Crisis Overlay (Modals/Reports) */}
      <ReportModal />
    </div>
  );
}