# Weekly global DR job

A GitHub Action attempts to collect the shared global and fleet DR history weekly.
A schedule is not evidence that fresh observations were received.

## Schedule

- Workflow: `.github/workflows/update-global-dr.yml`
- Cron: `0 4 * * 1` — every Monday at ~04:00 UTC.
- Also runnable manually via `workflow_dispatch`.

## What it does

1. Checks out the repo with `GITHUB_TOKEN`.
2. Runs `node scripts/update-global-dr.mjs` for the global list
   (`data/global-sites.json` → `data/global-dr.json`).
3. Runs the same script again with `--sites data/fleet-sites.json
   --data data/fleet-dr.json --label fleet` for the fleet-owned list.
4. Copies both JSON files into `public/data/` for the next approved static deployment.
5. Commits `data/{global,fleet}-dr.json` and
   `public/data/{global,fleet}-dr.json` with message
   `chore(dr): weekly update global DR history` and pushes, only if there
   are changes.

## The script

`scripts/update-global-dr.mjs`:

- Reads the seed list, fetches each domain's DR from the Ahrefs free
  public endpoint with a friendly `User-Agent` and a 650 ms delay between
  requests (see [ADR-0006](../../architecture/decisions/0006-request-pacing.md)).
- Appends a new `{ts, dr}` point only if there is not already a point for
  today (same UTC calendar day). Another successful observation that day
  replaces that point, including its timestamp, even if DR is unchanged.
- Preserves history for domains removed from the seed list (seeds from
  `existing.domains`).
- Preserves `communityNominations` if present.
- Writes the JSON back with `JSON.stringify(..., null, 2)` + trailing
  newline.

## Failure modes

- A failed domain keeps its prior history. Successful collections record
  attempted/succeeded/failed counts. Only real successful observations advance
  `lastUpdated`; partial success does not mean every domain is current.
- If every lookup fails (or there are no targets), the CLI exits nonzero without
  writing the data file. Provider requests have a 15-second timeout.
- Older files may have a misleading `lastUpdated` from the previous collector.
  Freshness must be derived from each domain's latest history timestamp.
- A `429` from Ahrefs logs a warn for that domain and moves on. The 650 ms
  pacing is conservative; sustained `429`s would indicate the free tier is
  overloaded — do not tighten the delay.
- If the commit/push step finds no changes, it prints "No changes to
  commit" and exits cleanly.

## Local run

```bash
node scripts/update-global-dr.mjs
node scripts/update-global-dr.mjs --sites data/fleet-sites.json --data data/fleet-dr.json --label fleet
```

The script writes to the `data/` files in place; you must commit manually
if running locally.

## Where the data goes

- `data/global-dr.json` is bundled into the build (instant first paint)
  and re-fetched from same-origin `/data/global-dr.json` by default. Both copies
  reflect the deployed snapshot. A configured public external origin can override
  this; it is not the default. See [ADR-0007](../../architecture/decisions/0007-observation-freshness.md).
- `public/data/global-dr.json` and `public/data/fleet-dr.json` are the
  downloadable copies surfaced on the `/data` page.

The workflow lives in the standalone `sass-maker/drank` repository.
Committing a dataset does not deploy Pages. Production deployment remains a
separate authorized action.

## Qualification receipt — 2026-09-07

The [scheduled run](https://github.com/sass-maker/drank/actions/runs/34104568403)
reported success and advanced the raw file date to September 7 while all 45
latest global observations remained August 17. The deployed browser showed
August 31 as its file date and three-week-old observations. Those timestamps
establish stale data, not its underlying credential/provider failure cause.

The repaired collector has a credential-free CLI test that injects HTTP 403,
asserts nonzero exit and byte-identical history, plus partial-success, valid-zero,
invalid-rating and same-day observation tests. UI helpers reject stale or widely
spaced weekly comparisons; full historical rows remain visible. The dataset's
`?domain=` links now select the matching shared history on first load.
Chrome verification confirmed the deployed history itself contains 11 points
through August 17, while its dataset deep link did not open history. The repaired
local static build opens the matching history, dismisses without reopening, and
shows all 45 historical rows with unavailable current-week comparisons.

### Live proxy and personal journey follow-up

Fresh anonymous Chrome contexts on September 7 verified the deployed personal
journey: add an owned domain, receive a real proxy result, refresh history,
reload, export through the UI, import into a fresh 390 px browser, then reload
with identical history. There is no signed-in variant: personal state is local.
The same public proxy returned valid fresh results for all 45 shared domains
at the existing 650 ms collector pacing. This does not verify the scheduled
collector's direct-provider credential or deploy a new shared snapshot.

The browser exposed two source defects: the personal/weekly count stayed zero
after adding a site, and the narrow header clipped controls while Settings lost
its accessible name. The count now derives from reactive domain state; compact
header buttons retain accessible labels. Built-static-browser checks at 390 and
1440 px verified all three controls within the viewport, import count 1, add
count 2, reload count 2, and no horizontal overflow. Those local add lookups used
an explicitly synthetic API response. Full quality (80 tests) and build passed.
These repairs are source-qualified, not deployed.

The new raw bulk snapshot was kept out of the public repository. The current
[Ahrefs DR license](https://ahrefs.com/legal/domain-rating-license) requires a
legible adjacent linked “Domain Rating by Ahrefs” attribution and restricts raw
DR redistribution and competing data services. Public dataset/download and
cross-product distribution need an explicit review against those terms; the
existing generic footer alone is not proof of that qualification. This is a
distribution gate, not a claim that fresh provider access failed.

Remaining [#18](https://github.com/sass-maker/drank/issues/18) acceptance:

- Verify the scheduled direct-provider collector records successful observations
  with correct freshness; public-proxy success does not establish that path.
- Resolve attribution and raw-data distribution scope before publishing a new
  shared dataset or treating cross-product reuse as qualified.
- Deploy the checked source through an authorized release and repeat narrow and
  desktop personal/history/data-link journeys against that exact deployment.
- Retain the owner-authored learning notes; advisor and public nomination paths
  were not exercised in this personal-tracking qualification.

### Attribution repair — 2026-09-08

The current [Ahrefs terms](https://ahrefs.com/legal/domain-rating-license) were
rechecked. Linked, legible “Domain Rating by Ahrefs” credit now appears beside
rating cards, history, leaderboard and data-page displays, rather than only a
faint generic footer. A built-static 390px browser shows the linked credit beside
ratings with no horizontal overflow. All 80 tests, full quality and static build
pass. These source checks do not resolve raw-data redistribution, qualify the
scheduled provider path, or establish new observation freshness. Issue #18
retains those separate gates.
