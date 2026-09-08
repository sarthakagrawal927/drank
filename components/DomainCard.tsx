'use client';

import { motion } from 'framer-motion';
import { DrAttribution } from '@/components/DrAttribution';
import { ArrowDown, ArrowUp, Minus, RefreshCw, BarChart3, Trash2 } from 'lucide-react';
import {
  Sparkline,
  formatRelativeTime,
  getCurrentDR,
  getDRBarColor,
  getDRColor,
  getFaviconUrl,
  getTrend,
  getWeeklyChange,
} from '@/lib/utils';
import type { TrackedDomain } from '@/lib/types';

interface DomainCardProps {
  d: TrackedDomain;
  isCustom: boolean;
  isUpdating: boolean;
  onOpen: (domain: string) => void;
  actions?: {
    onRefresh?: (domain: string) => void;
    onRemove?: (domain: string) => void;
  };
}

export function DomainCard({ d, isCustom, isUpdating, onOpen, actions }: DomainCardProps) {
  const onRefresh = actions?.onRefresh;
  const onRemove = actions?.onRemove;
  const dr = getCurrentDR(d);
  const t = getTrend(d);
  const weekly = getWeeklyChange(d);
  const color = getDRColor(dr);

  return (
    <motion.div
      key={d.domain}
      initial={false}
      whileHover={{ y: isCustom ? -4 : -3 }}
      onClick={() => onOpen(d.domain)}
      className={`group cursor-pointer rounded-3xl border border-white/10 ${
        isCustom
          ? 'bg-zinc-900/70 hover:border-emerald-900/40 hover:bg-zinc-900 active:scale-[0.995]'
          : 'bg-zinc-900/60 hover:border-white/20 hover:bg-zinc-900'
      } p-5 transition flex flex-col`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={getFaviconUrl(d.domain)}
            alt=""
            className="h-6 w-6 rounded-md ring-1 ring-white/10"
            onError={(e) => ((e.currentTarget as any).style.display = 'none')}
          />
          <div>
            <div className="font-mono text-[15px] font-medium tracking-tight text-white truncate">
              {d.domain}
            </div>
            {isCustom ? (
              <div className="text-[10px] text-emerald-400/70">your site • auto weekly</div>
            ) : null}
          </div>
        </div>
        {isCustom ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.(d.domain);
            }}
            className="rounded-xl p-1.5 text-white/40 opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-red-400 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : (
          <div className="text-[10px] text-emerald-400/60">shared</div>
        )}
      </div>

      <div className="mt-5 flex items-baseline gap-3">
        <div
          className={`text-[64px] leading-none font-semibold tabular-nums tracking-[-3.5px] ${color.text}`}
        >
          {dr != null ? dr.toFixed(1) : '—'}
        </div>
        {dr !== null && (
          <div
            className="h-2 w-8 rounded-full self-end mb-3"
            style={{ background: getDRBarColor(dr) }}
          />
        )}
      </div>

      <DrAttribution />

      <div className="flex items-center gap-2 text-sm mt-0.5">
        {t && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-px text-xs font-medium ${t.direction === 'up' ? 'bg-emerald-500/10 text-emerald-400' : t.direction === 'down' ? 'bg-red-500/10 text-red-400' : 'bg-white/5'}`}
          >
            {t.direction === 'up' && <ArrowUp className="h-3 w-3" />}
            {t.direction === 'down' && <ArrowDown className="h-3 w-3" />}
            {t.direction === 'flat' && <Minus className="h-3 w-3" />}
            {t.delta !== 0 ? (t.delta > 0 ? `+${t.delta}` : t.delta) : ''}
          </span>
        )}
        {weekly && weekly.delta !== 0 && (
          <span className="text-xs text-white/50">
            {isCustom ? '~' : ''}7d {weekly.delta > 0 ? '+' : ''}
            {weekly.delta}
          </span>
        )}
      </div>

      <div className="mt-auto pt-5 flex items-end justify-between">
        <Sparkline history={d.history} width={86} height={28} />
        <div className="text-right text-[10px] text-white/50">
          {isCustom ? 'LAST CHECKED' : 'LAST SHARED'}
          <br />
          {formatRelativeTime(d.lastChecked)}
        </div>
      </div>

      {isCustom ? (
        <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onRefresh?.(d.domain)}
            disabled={isUpdating}
            className="flex-1 rounded-2xl border border-white/10 py-2 text-xs font-medium hover:bg-white/5 active:bg-white/10 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isUpdating ? 'animate-spin' : ''}`} /> REFRESH
          </button>
          <button
            onClick={() => onOpen(d.domain)}
            className="flex-1 rounded-2xl border border-white/10 py-2 text-xs font-medium hover:bg-white/5 active:bg-white/10 flex items-center justify-center gap-1.5"
          >
            <BarChart3 className="h-3.5 w-3.5" /> HISTORY
          </button>
        </div>
      ) : (
        <div className="mt-4 text-[11px] text-white/40 group-hover:text-white/60 transition">
          Click for full shared history →
        </div>
      )}
    </motion.div>
  );
}
