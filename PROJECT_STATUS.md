# drank — PROJECT STATUS
Last updated: 2026-08-09

## Why / What

**drank** is a private, local-only Next.js dashboard for tracking Domain Rating (DR) over time via Ahrefs' free public API. Product thesis: beautiful DR tracking with zero sign-up — personal data stays in the browser; global leaderboard data is shared via public JSON.

**Users:** SEO practitioners tracking personal domains; community members nominating/predicting top sites; High Signal readers using the `/domains` lens.

**Constraints:** Real background server crons cannot touch per-user `localStorage`. Weekly personal refresh is client-opportunistic (runs when tab is open). Ahrefs free API rate limits (~750ms between bulk refreshes).

**IN scope:** Single-page dashboard (`app/page.tsx`), `/api/dr` and `/api/advisor` Pages Functions, global JSON pipeline, High Signal integration.

**OUT of scope:** Server-side personal domain storage without explicit opt-in.

## Dependencies

### External

- **Ahrefs free public API:** Domain Rating endpoint proxied via `/api/dr`; ~750ms between bulk refreshes; free/unit-free but needs `AHREFS_API_KEY` from 2026-08-10.
- **GitHub Actions:** weekly global DR update cron (passes `AHREFS_API_KEY` via `secrets: inherit`).
- **Cloudflare Pages:** deploy target (static export via `output: 'export'`, served from `out/`; `/api/dr` runs as a Pages Function with optional `AHREFS_API_KEY` binding).

### Internal (fleet)

- **High Signal:** `/domains` lens imports global DR history + `communityNominations` from drank's shared pipeline (https://highsignal.app/domains).
- **free-ai:** optional server-side DR Advisor generation through the existing gateway; successful advice remains browser-local.

### Stack & commands

**Stack:** Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + Recharts + framer-motion; versioned localStorage (v2). Biome resolves the pinned Ultracite framework presets through Fleet's shared lint baseline. No database, no auth.

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install deps (pnpm 10+; repo pins `pnpm@10.33.2`) |
| `pnpm dev` | Dev server → http://localhost:3000 |
| `pnpm build` | Production build (`next build --webpack` → `out/`) |
| `pnpm start` | Production server (rarely used; we deploy static `out/`) |
| `pnpm lint` / `pnpm check` | Biome check (`biome check .`; no ESLint) |
| `pnpm quality` | Complete Fleet code-health gate |

**Deploy:** Cloudflare Pages — manual `pnpm deploy` (builds then runs the pinned
Wrangler Pages command). CI validates `main` but does not deploy it.

**Env files:** none required for local static UI. Production Pages Function and weekly DR cron need `AHREFS_API_KEY` (free Ahrefs account key; not a paid API plan) from 2026-08-10.

## Timeline

- **2026-08-20 — Standalone ownership restored:** Synchronized the maintained
  DRank source out of Fleet Workspace into `sass-maker/drank`, restored local
  checks and documentation, and made deploys explicitly manual. Fleet retains
  only portfolio and cross-product metric references.
- **2026-08-12** — Adopted Fleet's measurable code-health gate across format,
  lint, types, tests and coverage, unused code, complexity, duplication, cycles,
  and dependency risk. Removed the duplicate batch-refresh implementation and
  redundant root documentation boundary; remaining exact legacy baselines are tracked
  in GitHub issue #322.
- **2026-08-09** — Released the tested dashboard to the `drank` Cloudflare
  Pages project, verified the public surface, and pinned Next.js output tracing
  to the component root so monorepo and component lockfiles no longer produce a
  misleading build warning.
- **2026-08-09** — Passed the maintenance release smoke for add, refresh, and
  JSON export against the production static build. Removed the invalid App
  Router ICO that made the Next.js development route fail, and switched the
  default observation refresh from an unreachable private-repository raw URL
  to the published same-origin data copy. Production deployment remains a
  separate manual action.
- **2026-08-09** — Adopted Fleet's shared Ultracite-backed Biome baseline as
  the bounded first pilot. The existing check now resolves pinned React,
  Next.js, and Vitest presets while retaining the documented Fleet exceptions;
  generated generic lint guidance remains separate from product-owned
  `AGENTS.md` instructions.
- **2026-08-07** — Wired optional `AHREFS_API_KEY` into `/api/dr`, the weekly
  global/Fleet DR update script, and the reusable workflow `secrets: inherit`
  path so free DR lookups keep working after Ahrefs' 2026-08-10 auth change.
- **2026-08-05** — Removed the dashboard webfont dependency from the initial
  render path. The production build now uses the system font stack, eliminating
  the font wait that delayed the text LCP shell.
- **2026-07-31** — Restored the documented weekly global and Fleet DR refresh
  as a monorepo-root GitHub Action with bounded concurrency, timeout, and
  write permissions.
- **2026-07-31** — Aligned search and agent discovery to the three canonical
  public pages. The HTML sitemap now derives from the generated agent catalog,
  query-string duplicates are excluded, and Home, Data, and Changelog each
  have substantive Markdown plus route-correct canonical and social metadata.
- **2026-07-29** — Added the owned `/changelog` surface with verified editorial
  release history. The dashboard links to it alongside the GitHub Issues
  roadmap and canonical Fleet source directory.
- **2026-07-13** — Shipped DR Advisor on the current Cloudflare Pages architecture: explicit, structured explanations grounded only in observed DR/trend, browser-local caching, and fail-closed server-side gateway credentials.
- **2026-07-02** — Added Next.js error boundaries (`app/error.tsx`, `app/global-error.tsx`); removed dead `web-vitals` dependency and unused vitals files.
- **Weekly (Mondays ~04:00 UTC)** — GitHub Action `update-global-dr.yml` runs `scripts/update-global-dr.mjs`, commits `data/global-dr.json`.
- **Shipped** — Global example sites (~45), nomination/prediction flow, client-opportunistic weekly personal refresh, High Signal `/domains` integration, Ahrefs proxy API.

## Products

- **Standalone dashboard:** single-page app (`app/page.tsx`); deploys to Cloudflare Pages (static export). Also runs locally at http://localhost:3000.
- **Changelog:** `/changelog` keeps verified product history on the product
  domain; planned work remains in DRank's GitHub Issues.
- **Shared data pipeline:** `data/global-dr.json` + `data/global-sites.json` —
  ~45 global example sites; the static export publishes current observations
  at `/data/global-dr.json` while the site list remains build-pinned.
- **High Signal lens:** https://highsignal.app/domains — consumes global DR history + community nominations; full interactive experience (personal predictions, local tracking, detailed history) remains in drank standalone.

## Features (shipped)

### Core dashboard (`app/page.tsx`, `lib/`)

- Card-based UI: Bento stats, DomainCards, sparklines (custom SVG), trend pills, search/sort/filter.
- Full CRUD for personal domains; rich detail modal with Recharts AreaChart + history table.
- Export/import personal data as JSON; keyboard shortcuts; framer-motion animations; empty states.
- Gainers & Losers section; premium modals; friendly rate-limit toasts (~750ms between bulk refreshes).
- Two sections: **Global Examples** (shared, non-custom) and **Your Sites** (private, `isCustom`).

### Architecture & storage

- All personal domains, history, predictions, settings in browser `localStorage` (v2 schema via `lib/useTrackedDomains.ts`).
- Global example sites (~45) load from `data/global-dr.json` — identical for all users, updated weekly by GitHub Action.
- Client calls `/api/dr?target=` → Cloudflare Pages Function (`functions/api/dr.ts`) proxies Ahrefs free endpoint with friendly User-Agent (CORS bypass).
- The browser refreshes global observations from the same-origin
  `/data/global-dr.json`; it never probes the private Fleet repository.
- No auth, no server storage of user data.

### Global & social

- Global example sites (~45) with shared `data/global-dr.json` history.
- Weekly GitHub Action (`.github/workflows/update-global-dr.yml`): Mondays ~04:00 UTC, runs `scripts/update-global-dr.mjs`, commits `data/global-dr.json`.
- `data/global-sites.json` seed list; `communityNominations` merged from community predictions.
- Current Leaderboard (top ~15 ranked globals).
- Nomination/prediction flow: nominate contenders, live scoring against actual leaderboard ("X of your picks in Top 20").
- "Share my predictions" generates GitHub issue + copyable list for community merge.

### Personal refresh scheduler (`lib/useTrackedDomains.ts`)

- Client-opportunistic weekly auto-refresh for user-added (`isCustom`) domains only.
- Triggers on load, visibility/focus, light poll.
- UI status ("Next in ~4d"), manual "Run now", on/off toggle.

### API proxy (`functions/api/dr.ts`)

- Cloudflare Pages Function that proxies Ahrefs free Domain Rating endpoint: https://docs.ahrefs.com/en/api/reference/public/get-domain-rating-free
- Solves CORS; sets friendly User-Agent. Served at `/api/dr` by `wrangler pages deploy`.

### DR Advisor (`functions/api/advisor.ts`, `components/DrAdvisor.tsx`)

- Explicit Explain/Regenerate action in domain history; opening a domain never calls AI.
- Uses only normalized domain, current DR, and bounded trend context.
- Strict structured output separates measurement interpretation, evidence limits, and 3–5 prioritized general actions.
- Gateway keys stay in the Pages Function environment; valid responses are cached only in browser localStorage.
- Missing configuration, rate limits, provider errors, and invalid output leave normal DR tracking available.

### Key files

- `app/page.tsx` — entire UI (single page).
- `lib/types.ts`, `lib/utils.tsx` — normalize, fetch, sort, colors, seed, sparkline, persistence.
- `lib/useTrackedDomains.ts` — state + refresh logic.
- `data/global-sites.json`, `data/global-dr.json` — shared history.

## Work queue

Open work is tracked only in [GitHub Issues](https://github.com/sass-maker/drank/issues).
An open issue is a to-do, a linked pull request is in progress, and merge plus
issue closure makes the work done.

## Freshness qualification — 2026-09-07

The collector and dashboard now distinguish successful observations from file
updates, reject all-failed collection runs without rewriting history, and avoid
presenting stale comparisons as current weekly changes. Public dataset deep
links select shared domain history. Evidence and remaining gates live in the
[weekly job receipt](docs/operations/jobs/weekly-global-dr.md); task reconciliation
is [#17](https://github.com/sass-maker/drank/issues/17) and
[#18](https://github.com/sass-maker/drank/issues/18). No production deployment or
fresh provider observations were performed by this repair.
