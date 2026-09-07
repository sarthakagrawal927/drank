#!/usr/bin/env node
/**
 * GitHub Action script to update shared historical Domain Rating data
 * for the global example sites.
 *
 * Fetches from Ahrefs' free public domain-rating-free endpoint. Free and
 * unit-free, but requires an API key from 2026-08-10 (AHREFS_API_KEY env var):
 * https://docs.ahrefs.com/en/api/reference/public/get-domain-rating-free
 * Appends weekly-ish snapshots to data/global-dr.json
 *
 * Run locally: node scripts/update-global-dr.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { configuredTargets } from './configured-targets.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? join(ROOT, args[index + 1]) : fallback;
};
const SITES_PATH = flag('--sites', join(ROOT, 'data/global-sites.json'));
const DATA_PATH = flag('--data', join(ROOT, 'data/global-dr.json'));
const LABEL = flag('--label', 'global').split('/').at(-1);
const onlyIndex = args.indexOf('--only');
const ONLY_DOMAIN = onlyIndex >= 0 ? args[onlyIndex + 1]?.trim().toLowerCase() : null;
const EXPLICIT_TARGETS = args.flatMap((value, index) =>
  value === '--target' && args[index + 1] ? [args[index + 1].trim().toLowerCase()] : []
);
if (onlyIndex >= 0 && !ONLY_DOMAIN) throw new Error('--only requires a domain');

const API_BASE = 'https://api.ahrefs.com/v3/public/domain-rating-free';
const DELAY_MS = 650; // be nice to the free public endpoint

async function fetchDR(domain) {
  const url = `${API_BASE}?target=${encodeURIComponent(domain)}&output=json`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        'User-Agent': 'drank-global-update/1.0 (+github-actions)',
        Accept: 'application/json',
        ...(process.env.AHREFS_API_KEY
          ? { Authorization: `Bearer ${process.env.AHREFS_API_KEY}` }
          : {}),
      },
    });
    if (!res.ok) {
      console.warn(`  [warn] ${domain} -> HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    const raw = json?.domain_rating?.domain_rating;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw <= 100) {
      return raw; // keep full decimal precision from Ahrefs
    }
    console.warn(`  [warn] ${domain} -> unexpected payload`);
    return null;
  } catch (err) {
    console.warn(`  [warn] ${domain} -> ${err.message}`);
    return null;
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`Updating ${LABEL} DR history...`);

  const configuredSites = configuredTargets(
    JSON.parse(readFileSync(SITES_PATH, 'utf8')),
    EXPLICIT_TARGETS
  );
  const sites = ONLY_DOMAIN
    ? configuredSites.filter((domain) => domain.toLowerCase() === ONLY_DOMAIN)
    : configuredSites;
  if (ONLY_DOMAIN && sites.length === 0) {
    throw new Error(`${ONLY_DOMAIN} is not present in ${SITES_PATH}`);
  }
  console.log(`  Sites: ${sites.length}`);

  let existing = { lastUpdated: null, domains: {} };
  try {
    existing = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
    console.log(`  Existing data loaded, lastUpdated: ${existing.lastUpdated}`);
  } catch {
    console.log('  No existing data, starting fresh.');
  }

  const newData = await collectRatings(sites, existing, { fetchRating: fetchDR });

  writeFileSync(DATA_PATH, `${JSON.stringify(newData, null, 2)}\n`, 'utf8');
  console.log(`\nWrote ${DATA_PATH}`);
  console.log('Done.');
}

export async function collectRatings(sites, existing, options) {
  const { fetchRating, now = Date.now(), delay = sleep } = options;
  const domains = { ...(existing.domains || {}) };
  let succeeded = 0;
  for (const [index, domain] of sites.entries()) {
    const dr = await fetchRating(domain);
    if (typeof dr === 'number' && Number.isFinite(dr) && dr >= 0 && dr <= 100) {
      const history = [...(domains[domain]?.history || [])];
      const latest = history.at(-1);
      const today = new Date(now).toISOString().slice(0, 10);
      const latestDay = latest ? new Date(latest.ts).toISOString().slice(0, 10) : null;
      // Each successful lookup is an observation, even if the value is unchanged.
      if (latestDay === today) history[history.length - 1] = { ts: now, dr };
      else history.push({ ts: now, dr });
      domains[domain] = { history };
      succeeded += 1;
    }
    if (index < sites.length - 1) await delay(DELAY_MS);
  }
  if (succeeded === 0) {
    throw new Error(`No successful DR observations (${sites.length} attempted); history unchanged`);
  }
  console.log(`Collected ${succeeded}/${sites.length} domains; ${sites.length - succeeded} failed`);
  return {
    ...existing,
    lastUpdated: new Date(now).toISOString(),
    domains,
    communityNominations: existing.communityNominations || [],
    collection: { attempted: sites.length, succeeded, failed: sites.length - succeeded },
  };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
