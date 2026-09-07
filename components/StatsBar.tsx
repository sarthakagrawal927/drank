'use client';

import { BarChart3, TrendingUp, Users } from 'lucide-react';
import { computeGainersLosers, getWeeklyChange } from '@/lib/utils';
import type { TrackedDomain } from '@/lib/types';

interface StatsBarProps {
  stats: { count: number; avg: number | null; max: number | null; totalMeasurements: number };
  customCount: number;
  liveGlobalDomains: TrackedDomain[];
}

export function StatsBar({ stats, customCount, liveGlobalDomains }: StatsBarProps) {
  const { gainers, losers } = computeGainersLosers(liveGlobalDomains);
  const comparable = liveGlobalDomains.filter((domain) => getWeeklyChange(domain) !== null).length;

  return (
    <div
      className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 content-auto"
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 220px' }}
    >
      <div className="group rounded-3xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[1px] text-zinc-500">
          <Users className="h-3.5 w-3.5" /> TOTAL TRACKED
        </div>
        <div className="mt-3 text-6xl font-semibold tabular-nums tracking-[-2px] text-white">
          {stats.count}
        </div>
        <div className="mt-1 text-xs text-emerald-400/80">your sites in this browser</div>
      </div>

      <div className="group rounded-3xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[1px] text-zinc-500">
          <BarChart3 className="h-3.5 w-3.5" /> YOUR SITES
        </div>
        <div className="mt-3 text-6xl font-semibold tabular-nums tracking-[-2px] text-white">
          {customCount}
        </div>
        <div className="mt-1 text-xs text-emerald-400/80">eligible for weekly auto</div>
      </div>

      <div className="group rounded-3xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[1px] text-zinc-500">
          AVG DR
        </div>
        <div className="mt-3 text-6xl font-semibold tabular-nums tracking-[-2px] text-white">
          {stats.avg ?? '—'}
        </div>
        <div className="mt-1 text-xs text-zinc-500">of sites with data</div>
      </div>

      <div className="group rounded-3xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[1px] text-zinc-500">
          <TrendingUp className="h-3.5 w-3.5" /> GLOBAL MOVERS
        </div>
        <div className="mt-3 flex items-baseline gap-3 text-6xl font-semibold tabular-nums tracking-[-2px]">
          <span className="text-white">{comparable ? gainers.length : '—'}</span>
          <span className="text-3xl text-emerald-400">↑</span>
          <span className="text-4xl text-zinc-400">/</span>
          <span className="text-white">{comparable ? losers.length : '—'}</span>
          <span className="text-3xl text-red-400">↓</span>
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          {comparable
            ? `gainers / losers among ${comparable} of ${liveGlobalDomains.length} comparable sites (~7d)`
            : 'Weekly movement unavailable — no recent comparisons'}
        </div>
      </div>
    </div>
  );
}
