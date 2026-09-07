import { describe, expect, it } from 'vitest';

import { configuredTargets } from './configured-targets.mjs';

describe('configuredTargets', () => {
  it('prefers explicit targets and removes duplicates', () => {
    expect(configuredTargets(['one.example.com'], ['example.com', 'example.com'])).toEqual([
      'example.com',
    ]);
  });

  it('normalizes configured targets when no explicit list is supplied', () => {
    expect(configuredTargets([' Example.com ', '', 'example.com'])).toEqual(['example.com']);
  });
});

import { collectRatings } from './update-global-dr.mjs';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

const now = Date.parse('2026-09-07T12:00:00Z');
const existing = {
  lastUpdated: '2026-08-17T00:00:00Z',
  domains: { 'example.com': { history: [{ ts: now - 21 * 86400000, dr: 50 }] } },
  communityNominations: [{ domain: 'retained.example' }],
};

describe('collection evidence', () => {
  it('initializes a first successful collection without inventing prior observations', async () => {
    const result = await collectRatings(
      ['new.example'],
      {},
      {
        now,
        fetchRating: async () => 12,
      }
    );
    expect(result.domains['new.example'].history).toEqual([{ ts: now, dr: 12 }]);
    expect(result.communityNominations).toEqual([]);
    expect(result.lastUpdated).toBe(new Date(now).toISOString());
  });

  it('rejects an empty target list', async () => {
    await expect(
      collectRatings([], existing, { now, fetchRating: async () => 12 })
    ).rejects.toThrow('0 attempted');
  });

  it('rejects an entirely failed collection without changing history or its date', async () => {
    const before = JSON.stringify(existing);
    await expect(
      collectRatings(['example.com'], existing, {
        now,
        fetchRating: async () => null,
      })
    ).rejects.toThrow('No successful DR observations');
    expect(JSON.stringify(existing)).toBe(before);
  });

  it('records partial success while preserving failed domains and nominations', async () => {
    const updated = await collectRatings(['example.com', 'new.example'], existing, {
      now,
      fetchRating: async (domain) => (domain === 'new.example' ? 0 : null),
      delay: async () => {},
    });
    expect(updated.collection).toEqual({ attempted: 2, succeeded: 1, failed: 1 });
    expect(updated.domains['example.com']).toEqual(existing.domains['example.com']);
    expect(updated.domains['new.example'].history).toEqual([{ ts: now, dr: 0 }]);
    expect(updated.communityNominations).toEqual(existing.communityNominations);
  });

  it('retains one point per day while recording another successful observation', async () => {
    const first = await collectRatings(['example.com'], existing, {
      now,
      fetchRating: async () => 50,
    });
    const second = await collectRatings(['example.com'], first, {
      now: now + 1000,
      fetchRating: async () => 50,
    });
    expect(second.domains['example.com'].history).toHaveLength(2);
    expect(second.domains['example.com'].history.at(-1)).toEqual({ ts: now + 1000, dr: 50 });
  });

  it('treats invalid ratings as failures', async () => {
    for (const rating of [NaN, Infinity, -1, 101]) {
      await expect(
        collectRatings(['example.com'], existing, {
          now,
          fetchRating: async () => rating,
        })
      ).rejects.toThrow('No successful');
    }
  });

  it('CLI exits nonzero and leaves the file byte-identical when provider returns 403', () => {
    const directory = mkdtempSync(join(tmpdir(), 'drank-collection-'));
    const path = join(directory, 'history.json');
    const before = JSON.stringify(existing);
    writeFileSync(path, before);
    const stub = 'data:text/javascript,globalThis.fetch=async()=>new Response(null,{status:403})';
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        stub,
        'scripts/update-global-dr.mjs',
        '--target',
        'example.com',
        '--data',
        relative(process.cwd(), path),
      ],
      { encoding: 'utf8' }
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('No successful DR observations');
    expect(readFileSync(path, 'utf8')).toBe(before);
  });
});
