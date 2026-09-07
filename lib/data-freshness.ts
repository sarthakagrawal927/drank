import type { HistoryPoint } from './types';

const DAY_MS = 86_400_000;

export function observationSummary(
  domains: Array<{ history: HistoryPoint[] }>,
  now = Date.now()
): string {
  const latest = domains.map(({ history }) =>
    Math.max(0, ...history.map((point) => point.ts).filter(Number.isFinite))
  );
  const newest = Math.max(0, ...latest);
  if (!newest) return 'No successful observations available';
  const stale = latest.filter((timestamp) => !timestamp || now - timestamp > 9 * DAY_MS).length;
  const date = new Date(newest).toISOString().slice(0, 10);
  return `Latest observation: ${date} UTC • ${stale} of ${domains.length} sites missing or older than 9 days`;
}

export function recentWeeklyBaseline(history: HistoryPoint[], now = Date.now()) {
  const sorted = [...history].sort((a, b) => a.ts - b.ts);
  const latest = sorted.at(-1);
  if (!latest || now - latest.ts > 9 * DAY_MS) return null;
  const base = sorted
    .slice(0, -1)
    .reverse()
    .find((point) => {
      const age = latest.ts - point.ts;
      return age >= 5 * DAY_MS && age <= 9 * DAY_MS;
    });
  return base ? { latest, base } : null;
}
