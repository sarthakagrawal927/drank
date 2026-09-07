import { describe, expect, it } from 'vitest';
import { observationSummary, recentWeeklyBaseline } from './data-freshness';

const now = Date.parse('2026-09-07T12:00:00Z');
const day = 86400000;

describe('observation freshness', () => {
  it('uses observation dates and counts every stale or missing site', () => {
    const summary = observationSummary(
      [
        { history: [{ ts: now - 21 * day, dr: 80 }] },
        { history: [] },
        { history: [{ ts: now, dr: 0 }] },
      ],
      now
    );
    expect(summary).toBe(
      'Latest observation: 2026-09-07 UTC • 2 of 3 sites missing or older than 9 days'
    );
    expect(observationSummary([], now)).toBe('No successful observations available');
  });

  it('rejects stale latest observations and widely separated comparison points', () => {
    expect(recentWeeklyBaseline([{ ts: now - 21 * day, dr: 80 }], now)).toBeNull();
    expect(
      recentWeeklyBaseline(
        [
          { ts: now - 40 * day, dr: 70 },
          { ts: now, dr: 80 },
        ],
        now
      )
    ).toBeNull();
  });

  it('allows a recent weekly comparison, even when values are equal', () => {
    const history = [
      { ts: now, dr: 80 },
      { ts: now - 7 * day, dr: 80 },
    ];
    expect(recentWeeklyBaseline(history, now)).toEqual({ latest: history[0], base: history[1] });
  });
});
