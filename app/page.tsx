'use client';

import { DrAttribution } from '@/components/DrAttribution';
import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Plus,
  Download,
  X,
  Search,
  BarChart3,
  Settings,
  Calendar,
  Trash2,
} from 'lucide-react';
const DrHistoryChart = lazy(() =>
  import('@/components/DrHistoryChart').then((m) => ({ default: m.DrHistoryChart }))
);

import { useTrackedDomains } from '@/lib/useTrackedDomains';
import {
  formatDate,
  getCurrentDR,
  getDRColor,
  getTrend,
  getFaviconUrl,
  formatNextAuto,
} from '@/lib/utils';
import type { Toast, TrackedDomain } from '@/lib/types';
import { observationSummary } from '@/lib/data-freshness';
import type { DrAdvisorRequest } from '@/lib/dr-advisor';
import { DrAdvisor } from '@/components/DrAdvisor';
import { DomainCard } from '@/components/DomainCard';
import { GainersLosers } from '@/components/GainersLosers';
import { PredictionsPanel } from '@/components/PredictionsPanel';
import { CommunityNominations } from '@/components/CommunityNominations';
import { Leaderboard } from '@/components/Leaderboard';
import { StatsBar } from '@/components/StatsBar';

// Shared global example sites + historical DR data (maintained via GitHub Action + JSON)
// Static import for build-time / offline fallback
import globalSitesStatic from '@/data/global-sites.json';
import globalDrDataStatic from '@/data/global-dr.json';

// The default same-origin copy is published with the static Pages export. A
// public external data origin can still be supplied explicitly when needed.
const GLOBAL_DATA_BASE = process.env.NEXT_PUBLIC_GLOBAL_DATA_BASE || '/data';
const GLOBAL_DR_URL = `${GLOBAL_DATA_BASE}/global-dr.json`;

// Build initial global domains from static (will be overwritten by fresh fetch on client)
const GLOBAL_DOMAINS: TrackedDomain[] = (globalSitesStatic as string[]).map((domain: string) => {
  const domainsObj = (globalDrDataStatic as any).domains || {};
  const hist = domainsObj[domain]?.history || [];
  return {
    domain,
    history: hist,
    lastChecked: hist.length > 0 ? hist[hist.length - 1].ts : null,
    isCustom: false,
  };
});

const COMMUNITY_NOMINATIONS: any[] = (globalDrDataStatic as any).communityNominations || [];

function isInputFocused(): boolean {
  return document.activeElement?.tagName === 'INPUT';
}

function createKeyboardHandler(opts: {
  showSettings: boolean;
  selectedDomain: string | null;
  closeSelectedDomain: () => void;
  toggleSettings: () => void;
  addInputRef: React.RefObject<HTMLInputElement | null>;
}): (e: KeyboardEvent) => void {
  return (e: KeyboardEvent) => {
    if (!isInputFocused() && !opts.showSettings) {
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
      if (e.key.toLowerCase() === 'a') {
        e.preventDefault();
        opts.addInputRef.current?.focus();
      }
    }
    if (e.key === 'Escape') {
      if (opts.selectedDomain) opts.closeSelectedDomain();
      else if (opts.showSettings) opts.toggleSettings();
    }
    if (e.key.toLowerCase() === 's' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      opts.toggleSettings();
    }
  };
}

function buildAdvisorRequest(selected: TrackedDomain | null): DrAdvisorRequest | null {
  if (!selected) return null;
  const currentDr = getCurrentDR(selected);
  if (currentDr === null) return null;
  const trend = getTrend(selected);
  return {
    domain: selected.domain,
    currentDr,
    trend: {
      direction: trend?.direction ?? ('unknown' as const),
      delta: trend?.delta ?? null,
      periodDays:
        selected.history.length >= 2
          ? Math.max(
              1,
              Math.min(
                365,
                Math.round(
                  (selected.history[selected.history.length - 1].ts -
                    selected.history[selected.history.length - 2].ts) /
                    86_400_000
                )
              )
            )
          : null,
    },
  };
}

function useLcpShell() {
  const [belowFold, setBelowFold] = useState(false);
  useEffect(() => {
    const shell = document.getElementById('drank-lcp-shell');
    if (shell) {
      shell.classList.add('drank-lcp-fading');
      const removeShell = () => shell.remove();
      shell.addEventListener('transitionend', removeShell, { once: true });
      setTimeout(removeShell, 300);
    }
    const run = () => setBelowFold(true);
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(run, { timeout: 1200 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(run, 0);
    return () => clearTimeout(t);
  }, []);
  return { belowFold };
}

function useGlobalData() {
  const [liveGlobalDomains, setLiveGlobalDomains] = useState<TrackedDomain[]>(GLOBAL_DOMAINS);
  const [liveCommunityNoms, setLiveCommunityNoms] = useState<any[]>(COMMUNITY_NOMINATIONS);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const drResponse = await fetch(GLOBAL_DR_URL, { cache: 'no-store' });
        if (cancelled || !drResponse.ok) return;
        const freshDr = await drResponse.json();
        const domainsObj = freshDr.domains || {};
        const freshDomains: TrackedDomain[] = (globalSitesStatic as string[]).map(
          (domain: string) => {
            const hist = domainsObj[domain]?.history || [];
            return {
              domain,
              history: hist,
              lastChecked: hist.length > 0 ? hist[hist.length - 1].ts : null,
              isCustom: false,
            };
          }
        );
        setLiveGlobalDomains(freshDomains);
        setLiveCommunityNoms(freshDr.communityNominations || []);
      } catch {
        // graceful fallback to the data bundled at build time
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const leaderboard = React.useMemo(
    () =>
      [...liveGlobalDomains]
        .map((d) => ({ ...d, currentDR: getCurrentDR(d) }))
        .sort((a, b) => (b.currentDR ?? -1) - (a.currentDR ?? -1)),
    [liveGlobalDomains]
  );
  return { liveGlobalDomains, liveCommunityNoms, leaderboard };
}

function useDomainSelection({
  selectedDomain,
  selectDomain,
  getUserDomain,
  liveGlobalDomains,
}: {
  selectedDomain: string | null;
  selectDomain: (domain: string | null) => void;
  getUserDomain: (domain: string) => TrackedDomain | undefined;
  liveGlobalDomains: TrackedDomain[];
}) {
  const [selectedSource, setSelectedSource] = useState<'global' | 'user' | null>(null);
  const getDomainRecord = (domain: string): TrackedDomain | undefined => {
    const global = liveGlobalDomains.find((d) => d.domain === domain);
    if (global) return global;
    return getUserDomain(domain);
  };
  const selected = selectedDomain
    ? selectedSource === 'user'
      ? (getUserDomain(selectedDomain) ?? null)
      : (getDomainRecord(selectedDomain) ?? null)
    : null;
  const selectedAdvisorRequest = buildAdvisorRequest(selected);
  const openGlobalDomain = useCallback(
    (domain: string) => {
      setSelectedSource('global');
      selectDomain(domain);
    },
    [selectDomain]
  );
  const openUserDomain = useCallback(
    (domain: string) => {
      setSelectedSource('user');
      selectDomain(domain);
    },
    [selectDomain]
  );
  const closeSelectedDomain = useCallback(() => {
    setSelectedSource(null);
    selectDomain(null);
  }, [selectDomain]);
  return {
    selected,
    selectedAdvisorRequest,
    openGlobalDomain,
    openUserDomain,
    closeSelectedDomain,
  };
}

function useDrankState() {
  const tracked = useTrackedDomains();
  const { belowFold } = useLcpShell();
  const { liveGlobalDomains, liveCommunityNoms, leaderboard } = useGlobalData();
  const selection = useDomainSelection({
    selectedDomain: tracked.selectedDomain,
    selectDomain: tracked.selectDomain,
    getUserDomain: tracked.getDomain,
    liveGlobalDomains,
  });
  const initialDomainHandled = useRef(false);
  useEffect(() => {
    if (initialDomainHandled.current) return;
    initialDomainHandled.current = true;
    const domain = new URLSearchParams(window.location.search).get('domain');
    if (domain && liveGlobalDomains.some((entry) => entry.domain === domain)) {
      selection.openGlobalDomain(domain);
    }
  }, [liveGlobalDomains, selection.openGlobalDomain]);
  const [addInput, setAddInput] = useState('');
  const [nominateInput, setNominateInput] = useState('');
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [_importing, setImporting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = createKeyboardHandler({
      showSettings,
      selectedDomain: tracked.selectedDomain,
      closeSelectedDomain: selection.closeSelectedDomain,
      toggleSettings: () => setShowSettings((v) => !v),
      addInputRef,
    });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tracked.selectedDomain, showSettings, selection.closeSelectedDomain]);
  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!addInput.trim()) return;
    await tracked.addDomain(addInput);
    setAddInput('');
  };
  const handleRefreshAll = async () => {
    setIsRefreshingAll(true);
    await tracked.refreshAll();
    setIsRefreshingAll(false);
  };
  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    await tracked.importData(file);
    setImporting(false);
    e.target.value = '';
  };
  const nextAutoLabel = formatNextAuto(tracked.lastAutoRefresh, tracked.autoRefreshEnabled);
  const predictionAccuracy = React.useMemo(() => {
    if (tracked.predictions.length === 0) return null;
    const top20Domains = new Set(leaderboard.slice(0, 20).map((d) => d.domain));
    const hits = tracked.predictions.filter((p) => top20Domains.has(p.domain)).length;
    return {
      hits,
      total: tracked.predictions.length,
      percent: Math.round((hits / tracked.predictions.length) * 100),
    };
  }, [tracked.predictions, leaderboard]);
  return {
    ...tracked,
    ...selection,
    belowFold,
    liveGlobalDomains,
    liveCommunityNoms,
    leaderboard,
    predictionAccuracy,
    addInput,
    setAddInput,
    nominateInput,
    setNominateInput,
    isRefreshingAll,
    showSettings,
    setShowSettings,
    fileInputRef,
    addInputRef,
    handleAdd,
    handleRefreshAll,
    handleImportClick,
    handleFileChange,
    nextAutoLabel,
  };
}

type DrankState = ReturnType<typeof useDrankState>;

function ToastStack({
  toasts,
  dismissToast,
}: {
  toasts: Toast[];
  dismissToast: (id: number) => void;
}) {
  return (
    <div className="fixed bottom-6 right-6 z-[90] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4 }}
            className={`flex max-w-[340px] items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
              t.type === 'error'
                ? 'border-red-500/30 bg-red-950/80 text-red-200'
                : t.type === 'success'
                  ? 'border-emerald-500/30 bg-emerald-950/70 text-emerald-200'
                  : 'border-white/10 bg-zinc-900/95 text-white'
            }`}
          >
            <div className="flex-1 pt-px">{t.message}</div>
            <button onClick={() => dismissToast(t.id)} className="text-white/40 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function SettingsPanel(props: {
  showSettings: boolean;
  onClose: () => void;
  autoRefreshEnabled: boolean;
  toggleAutoRefresh: (enabled: boolean) => void;
  lastAutoRefresh: number | null;
  nextAutoLabel: string;
  runAutoRefreshNow: () => Promise<void>;
  onImportClick: () => void;
  onExport: () => void;
  onClearAll: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const {
    showSettings,
    onClose,
    autoRefreshEnabled,
    toggleAutoRefresh,
    lastAutoRefresh,
    nextAutoLabel,
    runAutoRefreshNow,
    onImportClick,
    onExport,
    onClearAll,
    onFileChange,
    fileInputRef,
  } = props;
  return (
    <AnimatePresence>
      {showSettings ? (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/70 pt-16"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-xl tracking-tight">Preferences</div>
              <button onClick={onClose}>
                <X className="h-5 w-5 text-white/50" />
              </button>
            </div>

            <div className="mt-6 space-y-6 text-sm">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-medium">Weekly auto-refresh</div>
                    <div className="text-xs text-white/50 mt-0.5">
                      Only runs for sites you explicitly added (not the popular seed list).
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAutoRefresh(!autoRefreshEnabled)}
                    className={`relative h-7 w-12 rounded-full transition ${autoRefreshEnabled ? 'bg-emerald-500' : 'bg-white/20'}`}
                  >
                    <div
                      className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${autoRefreshEnabled ? 'left-[26px]' : 'left-0.5'}`}
                    />
                  </button>
                </div>
                <div className="rounded-2xl bg-white/5 p-4 text-xs leading-relaxed text-white/70">
                  When the dashboard is open (or you return to the tab), if it’s been more than 7
                  days since the last auto run, drank will quietly refresh only your custom sites.
                  This is the closest thing to a “cron” while keeping 100% of your data in
                  localStorage.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 p-4 text-xs">
                <div className="text-white/60">Last auto-refresh</div>
                <div className="mt-1 text-white">
                  {lastAutoRefresh
                    ? formatDate(lastAutoRefresh)
                    : 'Never (will run on next visit if enabled)'}
                </div>
                <div className="mt-3 text-white/60">Next expected</div>
                <div className="mt-1 text-emerald-400">{nextAutoLabel}</div>
              </div>

              <div>
                <button
                  onClick={async () => {
                    await runAutoRefreshNow();
                  }}
                  className="w-full rounded-2xl bg-white/10 py-3 text-sm font-medium hover:bg-white/15 active:bg-white/10"
                >
                  Run weekly refresh for my sites now
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={onImportClick}
                  className="flex-1 rounded-2xl border border-white/10 py-2.5 text-xs"
                >
                  Import JSON
                </button>
                <button
                  onClick={onExport}
                  className="flex-1 rounded-2xl border border-white/10 py-2.5 text-xs"
                >
                  Export JSON
                </button>
                <button
                  onClick={onClearAll}
                  className="flex-1 rounded-2xl border border-red-900/60 py-2.5 text-xs text-red-400"
                >
                  Clear everything
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={onFileChange}
              />
            </div>

            <div className="mt-8 text-center text-[10px] text-white/40">
              All data and settings are stored only in your browser.
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function DomainDetailModal(props: {
  selected: TrackedDomain | null;
  onClose: () => void;
  advisorRequest: DrAdvisorRequest | null;
  updating: Set<string>;
  onRefresh: (domain: string) => Promise<void>;
  onRemove: (domain: string) => void;
}) {
  const { selected, onClose, advisorRequest, updating, onRefresh, onRemove } = props;
  return (
    <AnimatePresence>
      {selected ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.18 }}
            className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-white/10 px-7 py-5">
              <div className="flex items-center gap-4">
                <img src={getFaviconUrl(selected.domain)} className="h-8 w-8 rounded-lg" alt="" />
                <div>
                  <div className="font-mono text-lg text-white">{selected.domain}</div>
                  <DrAttribution />
                  <div className="text-xs text-white/50">
                    {selected.isCustom ? 'Your site • auto-refreshes weekly' : 'Popular site'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {(() => {
                  const dr = getCurrentDR(selected);
                  return (
                    <div
                      className={`text-right text-6xl font-semibold tabular-nums tracking-[-2.5px] ${getDRColor(dr).text}`}
                    >
                      {dr != null ? dr.toFixed(1) : '—'}
                    </div>
                  );
                })()}
                <button
                  onClick={onClose}
                  className="rounded-full p-2 text-white/60 hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="max-h-[72vh] overflow-y-auto p-7">
              {/* Chart */}
              {selected.history.length >= 2 ? (
                <div className="h-80 w-full rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
                  <Suspense
                    fallback={
                      <div className="h-full animate-pulse rounded-xl bg-zinc-800/40" aria-hidden />
                    }
                  >
                    <DrHistoryChart history={selected.history} />
                  </Suspense>
                </div>
              ) : (
                <div className="flex h-60 items-center justify-center rounded-2xl border border-dashed border-white/10 text-center text-sm text-white/50">
                  Keep refreshing this domain over time to build a full history.
                </div>
              )}

              {advisorRequest ? <DrAdvisor request={advisorRequest} /> : null}

              {/* History list */}
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-widest text-white/50">
                  <div>HISTORY • {selected.history.length} POINTS</div>
                  <button
                    onClick={() => onRefresh(selected.domain)}
                    disabled={updating.has(selected.domain)}
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1 text-[11px] normal-case hover:bg-white/5"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${updating.has(selected.domain) ? 'animate-spin' : ''}`}
                    />{' '}
                    REFRESH NOW
                  </button>
                </div>

                <div className="max-h-[220px] overflow-auto rounded-2xl border border-white/10 bg-zinc-900/40 text-sm">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-zinc-950/90 text-xs text-white/50">
                      <tr>
                        <th className="px-5 py-3 text-left font-normal">DATE</th>
                        <th className="px-5 py-3 text-left font-normal">DR</th>
                        <th className="px-5 py-3 text-left font-normal">CHANGE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {[...selected.history].reverse().map((p, i, arr) => {
                        const prev = arr[i + 1];
                        const delta = prev ? p.dr - prev.dr : null;
                        return (
                          <tr key={p.ts}>
                            <td className="px-5 py-2.5 text-white/70 tabular-nums">
                              {formatDate(p.ts)}
                            </td>
                            <td className="px-5 py-2.5 font-medium tabular-nums text-white">
                              {p.dr.toFixed(1)}
                            </td>
                            <td className="px-5 py-2.5">
                              {delta === null ? (
                                <span className="text-white/40">—</span>
                              ) : (
                                <span
                                  className={
                                    delta > 0
                                      ? 'text-emerald-400'
                                      : delta < 0
                                        ? 'text-red-400'
                                        : 'text-white/40'
                                  }
                                >
                                  {delta > 0 ? '+' : ''}
                                  {delta.toFixed(1)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {selected.history.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-5 py-8 text-center text-white/50">
                            No measurements recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 bg-zinc-900/70 px-7 py-4">
              {selected?.isCustom ? (
                <button
                  onClick={() => {
                    if (confirm(`Remove ${selected.domain}?`)) onRemove(selected.domain);
                  }}
                  className="text-sm text-red-400/80 hover:text-red-400 flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" /> Remove this domain
                </button>
              ) : (
                <div className="text-xs text-emerald-400/70">
                  This is a shared global example (updated by GitHub Action)
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="rounded-2xl border border-white/10 px-6 py-2 text-sm hover:bg-white/5"
                >
                  Close
                </button>
                {selected?.isCustom ? (
                  <button
                    onClick={() => onRefresh(selected.domain)}
                    disabled={updating.has(selected.domain)}
                    className="rounded-2xl bg-white px-6 py-2 text-sm font-medium text-zinc-950 disabled:opacity-60"
                  >
                    Refresh now
                  </button>
                ) : null}
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function Header({
  onSettings,
  onExport,
  onRefreshAll,
  isRefreshingAll,
}: {
  onSettings: () => void;
  onExport: () => void;
  onRefreshAll: () => Promise<void>;
  isRefreshingAll: boolean;
}) {
  return (
    <div className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/95 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-zinc-950 shadow-inner">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold tracking-[-1.5px] text-2xl">drank</div>
            <div className="text-[10px] text-zinc-500 -mt-1 font-mono">DOMAIN RATING WATCH</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSettings}
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 sm:px-4 sm:py-2 text-sm hover:bg-white/10 active:bg-white/5 transition"
          >
            <Settings className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Settings</span>
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 sm:px-4 sm:py-2 text-sm hover:bg-white/10"
          >
            <Download className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Export</span>
          </button>
          <button
            onClick={onRefreshAll}
            disabled={isRefreshingAll}
            className="flex items-center gap-2 rounded-2xl bg-white p-3 sm:px-5 sm:py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200 active:bg-zinc-300 disabled:opacity-60 transition"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshingAll ? 'animate-spin' : ''}`} />
            <span className="sr-only sm:not-sr-only">
              {isRefreshingAll ? 'Refreshing…' : 'Refresh all'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <div className="mb-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(1.75rem,8.2vw,3.75rem)] leading-[1.05] font-semibold tracking-[-0.04em] text-white sm:leading-none sm:tracking-[-3.2px]">
            Track Domain Ratings.
            <br />
            100% in your browser.
          </h1>
          <p className="mt-3 max-w-md text-xl text-zinc-400">
            See the authority score of ~45 popular sites and your own — free Ahrefs API, no sign-up.
            Your personal history stays in this browser.
          </p>
        </div>
        <div className="hidden lg:block text-right text-sm text-zinc-500 max-w-[260px]">
          Press <span className="font-mono rounded bg-white/10 px-1.5 py-px">/</span> to search
          &nbsp;•&nbsp; <span className="font-mono rounded bg-white/10 px-1.5 py-px">A</span> to add
          &nbsp;•&nbsp; <span className="font-mono rounded bg-white/10 px-1.5 py-px">⌘S</span>{' '}
          settings
        </div>
      </div>
    </div>
  );
}

function AddDomainBar({ state }: { state: DrankState }) {
  return (
    <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <form onSubmit={state.handleAdd} className="flex w-full max-w-xl items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={state.addInputRef}
            id="add-input"
            type="text"
            value={state.addInput}
            onChange={(e) => state.setAddInput(e.target.value)}
            placeholder="Add your domain (mysite.com, blog.example.com...)"
            className="w-full rounded-3xl border border-white/10 bg-zinc-900 px-5 py-3 text-sm placeholder:text-zinc-500 focus:border-white/30 focus:bg-zinc-950 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-3xl bg-white px-8 text-sm font-medium text-zinc-950 transition active:scale-[0.985]"
        >
          <Plus className="h-4 w-4" /> Add site
        </button>
      </form>
      <button
        onClick={() => state.setShowSettings(true)}
        className="flex items-center gap-2 self-start rounded-3xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
      >
        <Calendar className="h-4 w-4 text-emerald-400" />
        <span className="font-medium text-emerald-400">{state.nextAutoLabel}</span>
        <span className="text-white/40">•</span>
        <span className="text-xs text-white/60">
          {state.autoRefreshEnabled ? `${state.customCount} sites` : 'disabled'}
        </span>
      </button>
    </div>
  );
}

function SearchControls({ state }: { state: DrankState }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-zinc-500" />
        <input
          id="search-input"
          type="text"
          value={state.search}
          onChange={(e) => state.setSearch(e.target.value)}
          placeholder="Search domains…"
          className="w-full rounded-3xl border border-white/10 bg-zinc-900 pl-10 py-2.5 text-sm placeholder:text-zinc-500 focus:border-white/30"
        />
      </div>
      <select
        value={state.sortMode}
        onChange={(e) => state.setSortMode(e.target.value as any)}
        className="h-11 rounded-3xl border border-white/10 bg-zinc-900 px-4 text-sm focus:border-white/30"
      >
        <option value="dr-desc">DR high → low</option>
        <option value="dr-asc">DR low → high</option>
        <option value="trend-desc">Biggest recent movers</option>
        <option value="updated-desc">Recently checked</option>
        <option value="name-asc">A → Z</option>
      </select>
      <div className="flex-1" />
      <div className="text-xs text-zinc-500 hidden md:block pr-1">
        {state.filteredAndSorted.length} of your sites shown • Global data is shared
      </div>
    </div>
  );
}

function GlobalExamplesSection({ state }: { state: DrankState }) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold tracking-wider text-emerald-400/90">
            GLOBAL EXAMPLES
          </div>
          <div className="text-xs text-white/50">
            Shared historical snapshots • collection is scheduled weekly; successful observations
            may be older
          </div>
        </div>
        <div className="text-xs text-white/40 tabular-nums">
          {observationSummary(state.liveGlobalDomains)}
        </div>
      </div>
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-10"
        style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 3400px' }}
      >
        <AnimatePresence>
          {state.liveGlobalDomains.map((d) => (
            <DomainCard
              key={`global-${d.domain}`}
              d={d}
              isCustom={false}
              isUpdating={state.updating.has(d.domain)}
              onOpen={state.openGlobalDomain}
            />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}

function LeaderboardSection({ state }: { state: DrankState }) {
  return (
    <>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="text-sm font-semibold tracking-wider text-white">
            LATEST OBSERVED LEADERBOARD
          </div>
          <div className="text-xs text-white/50">
            Ranked by Domain Rating • shared across all users from the GitHub-maintained JSON
          </div>
        </div>
        {state.predictionAccuracy != null && (
          <div className="text-right text-xs">
            <span className="text-emerald-400 font-medium">Your picks in this snapshot:</span>{' '}
            {state.predictionAccuracy.hits}/{state.predictionAccuracy.total} in Top 20 (
            {state.predictionAccuracy.percent}%)
          </div>
        )}
      </div>
      <div className="mb-3">
        <DrAttribution />
      </div>
      <Leaderboard
        leaderboard={state.leaderboard}
        onOpen={state.openGlobalDomain}
        onAddPrediction={state.addPrediction}
      />
      <PredictionsPanel
        predictions={state.predictions}
        nominate={{ input: state.nominateInput, set: state.setNominateInput }}
        onNominate={state.addPrediction}
        onRemovePrediction={state.removePrediction}
        leaderboard={state.leaderboard}
      />
      <CommunityNominations
        nominations={state.liveCommunityNoms}
        onOpen={state.openGlobalDomain}
        onAddPrediction={state.addPrediction}
      />
    </>
  );
}

function YourSitesSection({ state }: { state: DrankState }) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold tracking-wider text-white">YOUR SITES</div>
          <div className="text-xs text-emerald-400/80">
            Private • stored in your browser • auto-refreshed ~weekly when you visit
          </div>
        </div>
        <div className="text-xs text-white/40">{state.customCount} tracked</div>
      </div>
      {state.filteredAndSorted.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence>
            {state.filteredAndSorted.map((d) => (
              <DomainCard
                key={d.domain}
                d={d}
                isCustom={true}
                isUpdating={state.updating.has(d.domain)}
                onOpen={state.openUserDomain}
                actions={{ onRefresh: state.refreshDomain, onRemove: state.removeDomain }}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-zinc-900/50 p-8 text-center mb-8">
          <div className="text-lg font-medium text-white">
            No sites in your personal tracking yet
          </div>
          <p className="mt-2 text-sm text-white/60 max-w-sm mx-auto">
            Add domains above. They will be stored privately in your browser and can auto-refresh
            roughly once a week the next time you open this dashboard.
          </p>
        </div>
      )}
    </>
  );
}

function Footer() {
  return (
    <div className="mt-10 text-center text-[11px] text-white/40">
      No account. No personal-domain database. Your domains, history, and generated advice stay in
      this browser.
      <br className="mb-1" />
      <DrAttribution />
      <a
        href="https://highsignal.app/domains"
        target="_blank"
        rel="noopener noreferrer"
        className="underline text-white/30 hover:text-white/50"
      >
        also in highsignal.app
      </a>
      <span className="text-white/20"> · </span>
      <a href="/changelog" className="underline text-white/30 hover:text-white/50">
        changelog
      </a>
      <span className="text-white/20"> · </span>
      <a
        href="https://github.com/sass-maker/drank/issues"
        className="underline text-white/30 hover:text-white/50"
      >
        roadmap
      </a>
      <span className="text-white/20"> · </span>
      <a
        href="https://github.com/sass-maker/drank"
        className="underline text-white/30 hover:text-white/50"
      >
        source
      </a>
    </div>
  );
}

function DashboardContent({ state }: { state: DrankState }) {
  return (
    <>
      <StatsBar
        stats={state.stats}
        customCount={state.customCount}
        liveGlobalDomains={state.liveGlobalDomains}
      />
      <AddDomainBar state={state} />
      <SearchControls state={state} />
      <GlobalExamplesSection state={state} />
      <LeaderboardSection state={state} />
      <YourSitesSection state={state} />
      <GainersLosers domains={state.liveGlobalDomains} onOpen={state.openGlobalDomain} />
      <Footer />
    </>
  );
}

export default function Drank() {
  const state = useDrankState();
  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading your local data…
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200" style={{ contain: 'layout' }}>
      <Header
        onSettings={() => state.setShowSettings(true)}
        onExport={state.exportData}
        onRefreshAll={state.handleRefreshAll}
        isRefreshingAll={state.isRefreshingAll}
      />
      <div className="mx-auto max-w-7xl px-6 pt-10 pb-24">
        <Hero />
        {state.belowFold ? (
          <DashboardContent state={state} />
        ) : (
          <div
            className="min-h-[65vh] rounded-3xl border border-white/5 bg-zinc-900/20"
            style={{ contain: 'layout' }}
            aria-hidden
          />
        )}
      </div>
      <DomainDetailModal
        selected={state.selected}
        onClose={state.closeSelectedDomain}
        advisorRequest={state.selectedAdvisorRequest}
        updating={state.updating}
        onRefresh={state.refreshDomain}
        onRemove={state.removeDomain}
      />
      <SettingsPanel
        showSettings={state.showSettings}
        onClose={() => state.setShowSettings(false)}
        autoRefreshEnabled={state.autoRefreshEnabled}
        toggleAutoRefresh={state.toggleAutoRefresh}
        lastAutoRefresh={state.lastAutoRefresh}
        nextAutoLabel={state.nextAutoLabel}
        runAutoRefreshNow={state.runAutoRefreshNow}
        onImportClick={state.handleImportClick}
        onExport={state.exportData}
        onClearAll={state.clearAll}
        onFileChange={state.handleFileChange}
        fileInputRef={state.fileInputRef}
      />
      <ToastStack toasts={state.toasts} dismissToast={state.dismissToast} />
    </div>
  );
}
