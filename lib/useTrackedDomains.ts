'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  calculateStats,
  exportState,
  fetchDomainRating,
  importState,
  loadState,
  normalizeDomain,
  saveState,
  sortDomains,
} from './utils';
import type {
  HistoryPoint,
  Prediction,
  SortMode,
  StoredState,
  Toast,
  TrackedDomain,
} from './types';
import { useAutoRefresh, REFRESH_DELAY_MS } from './useAutoRefresh';
import { usePredictions } from './usePredictions';
import globalSitesStatic from '@/data/global-sites.json';

const GLOBAL_SITE_SET = new Set(
  (globalSitesStatic as string[]).map((domain) => domain.toLowerCase())
);

interface UseTrackedDomainsReturn {
  domains: TrackedDomain[];
  filteredAndSorted: TrackedDomain[];
  isLoading: boolean;
  updating: Set<string>;
  search: string;
  setSearch: (s: string) => void;
  sortMode: SortMode;
  setSortMode: (m: SortMode) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;

  addDomain: (input: string) => Promise<void>;
  refreshDomain: (domain: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  removeDomain: (domain: string) => void;
  clearAll: () => void;

  selectedDomain: string | null;
  selectDomain: (domain: string | null) => void;
  getDomain: (domain: string) => TrackedDomain | undefined;

  exportData: () => void;
  importData: (file: File) => Promise<boolean>;

  stats: { count: number; avg: number | null; max: number | null; totalMeasurements: number };

  autoRefreshEnabled: boolean;
  lastAutoRefresh: number | null;
  toggleAutoRefresh: (enabled: boolean) => void;
  runAutoRefreshNow: () => Promise<void>;
  customCount: number;

  predictions: Prediction[];
  addPrediction: (domain: string, note?: string) => void;
  removePrediction: (domain: string) => void;
}

type PersistFn = (
  nextDomains: TrackedDomain[],
  nextLastGlobal?: number | null,
  nextPreds?: Prediction[]
) => void;

function buildStoredState(
  domains: TrackedDomain[],
  lastGlobalRefresh: number | null,
  autoRefreshEnabled: boolean,
  lastAutoRefresh: number | null,
  predictions: Prediction[]
): StoredState {
  return {
    version: 2,
    domains,
    lastGlobalRefresh,
    autoRefreshEnabled,
    lastAutoRefresh,
    predictions,
  } as StoredState;
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(1);
  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = toastIdRef.current++;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts((current) => current.filter((tt) => tt.id !== id));
    }, 4200);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((tt) => tt.id !== id));
  }, []);
  return { toasts, showToast, dismissToast };
}

interface DomainStateCtx {
  showToast: (message: string, type: Toast['type']) => void;
}

function useDomainState(ctx: DomainStateCtx) {
  const { showToast } = ctx;
  const [domains, setDomains] = useState<TrackedDomain[]>(() => {
    const stored = loadState();
    if (stored?.domains?.length) {
      return stored.domains.map((d) => ({ ...d, isCustom: true }));
    }
    return [];
  });
  const domainsRef = useRef<TrackedDomain[]>([]);
  const [lastGlobalRefresh, setLastGlobalRefresh] = useState<number | null>(
    () => loadState()?.lastGlobalRefresh ?? null
  );
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('dr-desc');
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [isLoading] = useState(false);

  const persistRef = useRef<PersistFn>(() => {});
  const applyNewPointRef = useRef<(domain: string, dr: number, fetchedAt: number) => void>(
    () => {}
  );

  useEffect(() => {
    domainsRef.current = domains;
    const stored = loadState();
    if (!stored) {
      saveState(buildStoredState([], null, true, null, []));
    }
  }, [domains]);

  const updateDomains = useCallback((updater: (prev: TrackedDomain[]) => TrackedDomain[]) => {
    setDomains((prev) => {
      const next = updater(prev);
      domainsRef.current = next;
      persistRef.current(next);
      return next;
    });
  }, []);

  const applyNewPoint = useCallback(
    (domain: string, dr: number, fetchedAt: number) => {
      updateDomains((prev) =>
        prev.map((d) => {
          if (d.domain !== domain) return d;
          const point: HistoryPoint = { ts: fetchedAt, dr };
          const newHistory = [...d.history.filter((p) => p.ts !== point.ts), point].sort(
            (a, b) => a.ts - b.ts
          );
          return { ...d, history: newHistory, lastChecked: fetchedAt };
        })
      );
    },
    [updateDomains]
  );

  useEffect(() => {
    applyNewPointRef.current = applyNewPoint;
  }, [applyNewPoint]);

  const refreshDomain = useCallback(
    async (domain: string) => {
      setUpdating((u) => new Set(u).add(domain));
      const result = await fetchDomainRating(domain);
      setUpdating((u) => {
        const next = new Set(u);
        next.delete(domain);
        return next;
      });
      if ('error' in result) {
        showToast(`${domain}: ${result.error}`, 'error');
        return;
      }
      applyNewPoint(domain, result.dr, result.fetchedAt);
    },
    [showToast, applyNewPoint]
  );

  const selectDomain = useCallback((domain: string | null) => {
    setSelectedDomain(domain);
  }, []);

  const getDomain = useCallback(
    (domain: string) => domains.find((d) => d.domain === domain),
    [domains]
  );

  const filteredAndSorted = useMemo(() => {
    let result = domains;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((d) => d.domain.includes(q));
    }
    return sortDomains(result, sortMode);
  }, [domains, search, sortMode]);

  const stats = useMemo(() => calculateStats(domains), [domains]);

  return {
    domains,
    domainsRef,
    updating,
    setUpdating,
    selectedDomain,
    setSelectedDomain,
    lastGlobalRefresh,
    setLastGlobalRefresh,
    search,
    setSearch,
    sortMode,
    setSortMode,
    isLoading,
    updateDomains,
    applyNewPoint,
    applyNewPointRef,
    persistRef,
    refreshDomain,
    setDomains,
    selectDomain,
    getDomain,
    filteredAndSorted,
    stats,
  };
}

interface DomainRefreshCtx {
  domainsRef: React.RefObject<TrackedDomain[]>;
  setUpdating: React.Dispatch<React.SetStateAction<Set<string>>>;
  showToast: (message: string, type: Toast['type']) => void;
  isLoading: boolean;
  predictions: Prediction[];
  lastGlobalRefresh: number | null;
  setLastGlobalRefresh: (n: number) => void;
  applyNewPointRef: React.RefObject<(domain: string, dr: number, fetchedAt: number) => void>;
  persistRef: React.RefObject<PersistFn>;
}

function useDomainRefresh(ctx: DomainRefreshCtx) {
  const refreshDomains = useCallback(
    async (targets: TrackedDomain[]) => {
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        ctx.setUpdating((current) => new Set(current).add(target.domain));
        const result = await fetchDomainRating(target.domain);
        ctx.setUpdating((current) => {
          const next = new Set(current);
          next.delete(target.domain);
          return next;
        });
        if ('error' in result) {
          ctx.showToast(`${target.domain}: ${result.error}`, 'error');
        } else {
          ctx.applyNewPointRef.current(target.domain, result.dr, result.fetchedAt);
        }
        if (i < targets.length - 1) {
          await new Promise((resolveDelay) => setTimeout(resolveDelay, REFRESH_DELAY_MS));
        }
      }
    },
    [ctx]
  );

  const {
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    lastAutoRefresh,
    setLastAutoRefresh,
    toggleAutoRefresh,
    runAutoRefreshNow,
  } = useAutoRefresh({
    domainsRef: ctx.domainsRef,
    isLoading: ctx.isLoading,
    initial: {
      autoRefreshEnabled: loadState()?.autoRefreshEnabled ?? true,
      lastAutoRefresh: loadState()?.lastAutoRefresh ?? null,
    },
    persistContext: { lastGlobalRefresh: ctx.lastGlobalRefresh, predictions: ctx.predictions },
    callbacks: { showToast: ctx.showToast, refreshDomains },
  });

  const persist = useCallback(
    (nextDomains: TrackedDomain[], nextLastGlobal?: number | null, nextPreds?: Prediction[]) => {
      saveState(
        buildStoredState(
          nextDomains,
          nextLastGlobal !== undefined ? nextLastGlobal : ctx.lastGlobalRefresh,
          autoRefreshEnabled,
          lastAutoRefresh,
          nextPreds !== undefined ? nextPreds : ctx.predictions
        )
      );
    },
    [ctx, autoRefreshEnabled, lastAutoRefresh]
  );

  useEffect(() => {
    ctx.persistRef.current = persist;
  }, [ctx, persist]);

  const refreshAll = useCallback(async () => {
    const domains = ctx.domainsRef.current;
    if (domains.length === 0) return;
    ctx.showToast(
      `Refreshing ${domains.length} domains... (this may take ~${Math.ceil((domains.length * REFRESH_DELAY_MS) / 1000)}s)`,
      'info'
    );
    await refreshDomains([...domains]);
    const now = Date.now();
    ctx.setLastGlobalRefresh(now);
    persist(ctx.domainsRef.current, now, ctx.predictions);
    ctx.showToast('Refresh complete', 'success');
  }, [ctx, persist, refreshDomains]);

  return {
    refreshDomains,
    refreshAll,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    lastAutoRefresh,
    setLastAutoRefresh,
    toggleAutoRefresh,
    runAutoRefreshNow,
  };
}

interface DomainMutationsCtx {
  domains: TrackedDomain[];
  domainsRef: React.RefObject<TrackedDomain[]>;
  updateDomains: (updater: (prev: TrackedDomain[]) => TrackedDomain[]) => void;
  selectedDomain: string | null;
  setSelectedDomain: (domain: string | null) => void;
  showToast: (message: string, type: Toast['type']) => void;
  refreshDomain: (domain: string) => Promise<void>;
  setLastGlobalRefresh: (n: number | null) => void;
  setLastAutoRefresh: (n: number | null) => void;
  setAutoRefreshEnabled: (enabled: boolean) => void;
  setPredictions: (preds: Prediction[]) => void;
  setDomains: (domains: TrackedDomain[]) => void;
}

function useDomainMutations(ctx: DomainMutationsCtx) {
  const {
    domains,
    domainsRef,
    updateDomains,
    selectedDomain,
    setSelectedDomain,
    showToast,
    refreshDomain,
    setLastGlobalRefresh,
    setLastAutoRefresh,
    setAutoRefreshEnabled,
    setPredictions,
    setDomains,
  } = ctx;

  const addDomain = useCallback(
    async (input: string) => {
      const normalized = normalizeDomain(input);
      if (!normalized) {
        showToast('Please enter a valid domain (e.g. example.com)', 'error');
        return;
      }
      if (GLOBAL_SITE_SET.has(normalized)) {
        showToast(`${normalized} is already included in the shared examples`, 'info');
        return;
      }
      const existing = domains.find((d) => d.domain === normalized);
      if (existing) {
        showToast(`${normalized} is already tracked`, 'info');
        setSelectedDomain(normalized);
        await refreshDomain(normalized);
        return;
      }
      const newDomain: TrackedDomain = {
        domain: normalized,
        history: [],
        lastChecked: null,
        isCustom: true,
      };
      updateDomains((prev) => [...prev, newDomain]);
      showToast(`Added ${normalized}`, 'success');
      await refreshDomain(normalized);
      setSelectedDomain(normalized);
    },
    [domains, refreshDomain, updateDomains, showToast, setSelectedDomain]
  );

  const removeDomain = useCallback(
    (domain: string) => {
      updateDomains((prev) => prev.filter((d) => d.domain !== domain));
      if (selectedDomain === domain) {
        setSelectedDomain(null);
      }
      showToast(`Removed ${domain}`, 'info');
    },
    [updateDomains, selectedDomain, showToast, setSelectedDomain]
  );

  const clearAll = useCallback(() => {
    if (!confirm('Clear all tracked domains and their history? This cannot be undone.')) return;
    const empty: TrackedDomain[] = [];
    setDomains(empty);
    domainsRef.current = empty;
    setLastGlobalRefresh(null);
    setLastAutoRefresh(null);
    setSelectedDomain(null);
    setPredictions([]);
    setAutoRefreshEnabled(true);
    saveState(buildStoredState(empty, null, true, null, []));
    showToast('All data cleared', 'info');
  }, [
    showToast,
    setDomains,
    domainsRef,
    setLastGlobalRefresh,
    setLastAutoRefresh,
    setSelectedDomain,
    setPredictions,
    setAutoRefreshEnabled,
  ]);

  return { addDomain, removeDomain, clearAll };
}

interface DomainIOCtx {
  domains: TrackedDomain[];
  lastGlobalRefresh: number | null;
  autoRefreshEnabled: boolean;
  lastAutoRefresh: number | null;
  predictions: Prediction[];
  showToast: (message: string, type: Toast['type']) => void;
  setDomains: (domains: TrackedDomain[]) => void;
  domainsRef: React.RefObject<TrackedDomain[]>;
  setLastGlobalRefresh: (n: number | null) => void;
  setAutoRefreshEnabled: (enabled: boolean) => void;
  setLastAutoRefresh: (n: number | null) => void;
  setSelectedDomain: (domain: string | null) => void;
  setPredictions: (preds: Prediction[]) => void;
}

function useDomainIO(ctx: DomainIOCtx) {
  const {
    domains,
    lastGlobalRefresh,
    autoRefreshEnabled,
    lastAutoRefresh,
    predictions,
    showToast,
    setDomains,
    domainsRef,
    setLastGlobalRefresh,
    setAutoRefreshEnabled,
    setLastAutoRefresh,
    setSelectedDomain,
    setPredictions,
  } = ctx;

  const exportData = useCallback(() => {
    exportState(
      buildStoredState(domains, lastGlobalRefresh, autoRefreshEnabled, lastAutoRefresh, predictions)
    );
    showToast('Exported JSON', 'success');
  }, [domains, lastGlobalRefresh, autoRefreshEnabled, lastAutoRefresh, predictions, showToast]);

  const importData = useCallback(
    async (file: File): Promise<boolean> => {
      const parsed = await importState(file);
      if (!parsed) {
        showToast('Invalid or corrupted import file', 'error');
        return false;
      }
      const migrated = (parsed.domains || []).map((d: TrackedDomain) => ({
        ...d,
        isCustom: d.isCustom ?? true,
      }));
      const importedPreds = (parsed as any).predictions || [];
      setDomains(migrated);
      domainsRef.current = migrated;
      setLastGlobalRefresh(parsed.lastGlobalRefresh ?? null);
      setAutoRefreshEnabled(parsed.autoRefreshEnabled ?? true);
      setLastAutoRefresh(parsed.lastAutoRefresh ?? null);
      setSelectedDomain(null);
      setPredictions(importedPreds);
      saveState(
        buildStoredState(
          migrated,
          parsed.lastGlobalRefresh ?? null,
          parsed.autoRefreshEnabled ?? true,
          parsed.lastAutoRefresh ?? null,
          importedPreds
        )
      );
      showToast(`Imported ${migrated.length} domains`, 'success');
      return true;
    },
    [
      showToast,
      setDomains,
      domainsRef,
      setLastGlobalRefresh,
      setAutoRefreshEnabled,
      setLastAutoRefresh,
      setSelectedDomain,
      setPredictions,
    ]
  );

  return { exportData, importData };
}

export function useTrackedDomains(): UseTrackedDomainsReturn {
  const { showToast, toasts, dismissToast } = useToasts();

  const s = useDomainState({ showToast });
  const {
    domainsRef,
    setUpdating,
    selectedDomain,
    setSelectedDomain,
    lastGlobalRefresh,
    setLastGlobalRefresh,
    isLoading,
    updateDomains,
    applyNewPointRef,
    persistRef,
    setDomains,
  } = s;

  const p = usePredictions({
    initialPredictions: loadState()?.predictions || [],
    domainsRef,
    persistContext: {
      lastGlobalRefresh,
      autoRefreshEnabled: loadState()?.autoRefreshEnabled ?? true,
      lastAutoRefresh: loadState()?.lastAutoRefresh ?? null,
    },
    showToast,
  });

  const r = useDomainRefresh({
    domainsRef,
    setUpdating,
    showToast,
    isLoading,
    predictions: p.predictions,
    lastGlobalRefresh,
    setLastGlobalRefresh,
    applyNewPointRef,
    persistRef,
  });

  const m = useDomainMutations({
    domains: s.domains,
    domainsRef,
    updateDomains,
    selectedDomain,
    setSelectedDomain,
    showToast,
    refreshDomain: s.refreshDomain,
    setLastGlobalRefresh,
    setLastAutoRefresh: r.setLastAutoRefresh,
    setAutoRefreshEnabled: r.setAutoRefreshEnabled,
    setPredictions: p.setPredictions,
    setDomains,
  });

  const io = useDomainIO({
    domains: s.domains,
    lastGlobalRefresh,
    autoRefreshEnabled: r.autoRefreshEnabled,
    lastAutoRefresh: r.lastAutoRefresh,
    predictions: p.predictions,
    showToast,
    setDomains,
    domainsRef,
    setLastGlobalRefresh,
    setAutoRefreshEnabled: r.setAutoRefreshEnabled,
    setLastAutoRefresh: r.setLastAutoRefresh,
    setSelectedDomain,
    setPredictions: p.setPredictions,
  });

  return {
    ...s,
    ...r,
    ...m,
    ...io,
    ...p,
    customCount: s.domains.filter((domain) => domain.isCustom).length,
    toasts,
    dismissToast,
  };
}
