'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { saveState } from './utils';
import type { Prediction, Toast, TrackedDomain } from './types';

const REFRESH_DELAY_MS = 750;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface UseAutoRefreshArgs {
  domainsRef: React.RefObject<TrackedDomain[]>;
  isLoading: boolean;
  initial: {
    autoRefreshEnabled: boolean;
    lastAutoRefresh: number | null;
  };
  persistContext: {
    lastGlobalRefresh: number | null;
    predictions: Prediction[];
  };
  callbacks: {
    showToast: (message: string, type: Toast['type']) => void;
    refreshDomains: (targets: TrackedDomain[]) => Promise<void>;
  };
}

function persistAutoRefresh(
  domainsRef: React.RefObject<TrackedDomain[]>,
  persistContext: UseAutoRefreshArgs['persistContext'],
  autoRefreshEnabled: boolean,
  lastAutoRefresh: number | null
) {
  saveState({
    version: 2,
    domains: domainsRef.current,
    lastGlobalRefresh: persistContext.lastGlobalRefresh,
    autoRefreshEnabled,
    lastAutoRefresh,
    predictions: persistContext.predictions,
  });
}

function useAutoRefreshTriggers(isLoading: boolean, checkAndTriggerAuto: () => Promise<void>) {
  useEffect(() => {
    if (isLoading) return;
    const t = setTimeout(() => checkAndTriggerAuto(), 650);
    return () => clearTimeout(t);
  }, [isLoading, checkAndTriggerAuto]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkAndTriggerAuto();
    };
    const onFocus = () => checkAndTriggerAuto();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [checkAndTriggerAuto]);

  useEffect(() => {
    const id = setInterval(() => checkAndTriggerAuto(), 3 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [checkAndTriggerAuto]);
}

export function useAutoRefresh({
  domainsRef,
  isLoading,
  initial,
  persistContext,
  callbacks,
}: UseAutoRefreshArgs) {
  const { showToast, refreshDomains } = callbacks;
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(initial.autoRefreshEnabled);
  const [lastAutoRefresh, setLastAutoRefresh] = useState<number | null>(initial.lastAutoRefresh);
  const autoRefreshInFlightRef = useRef(false);

  const runAutoRefreshNow = useCallback(async () => {
    if (autoRefreshInFlightRef.current) return;
    const customDomains = domainsRef.current.filter((d) => d.isCustom);
    if (customDomains.length === 0) {
      showToast('No custom sites to auto-refresh yet. Add your own domains.', 'info');
      return;
    }
    autoRefreshInFlightRef.current = true;
    showToast(`Auto-refreshing ${customDomains.length} of your sites...`, 'info');
    try {
      await refreshDomains(customDomains);
      const ts = Date.now();
      setLastAutoRefresh(ts);
      persistAutoRefresh(domainsRef, persistContext, autoRefreshEnabled, ts);
      showToast('Weekly auto-refresh complete for your sites', 'success');
    } finally {
      autoRefreshInFlightRef.current = false;
    }
  }, [persistContext, autoRefreshEnabled, showToast, refreshDomains, domainsRef]);

  const checkAndTriggerAuto = useCallback(async () => {
    if (!autoRefreshEnabled) return;
    const last = lastAutoRefresh;
    if (!last || Date.now() - last > WEEK_MS) {
      if (!domainsRef.current.some((d) => d.isCustom)) return;
      await runAutoRefreshNow();
    }
  }, [autoRefreshEnabled, lastAutoRefresh, runAutoRefreshNow, domainsRef]);

  useAutoRefreshTriggers(isLoading, checkAndTriggerAuto);

  const toggleAutoRefresh = useCallback(
    (enabled: boolean) => {
      setAutoRefreshEnabled(enabled);
      persistAutoRefresh(domainsRef, persistContext, enabled, lastAutoRefresh);
      showToast(
        enabled ? 'Weekly auto-refresh enabled for your sites' : 'Weekly auto-refresh disabled',
        'info'
      );
    },
    [persistContext, lastAutoRefresh, showToast, domainsRef]
  );

  return {
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    lastAutoRefresh,
    setLastAutoRefresh,
    toggleAutoRefresh,
    runAutoRefreshNow,
  };
}

export { REFRESH_DELAY_MS };
