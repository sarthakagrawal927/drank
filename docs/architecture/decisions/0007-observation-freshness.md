# ADR-0007 — Observation freshness and deployed snapshots

**Date:** 2026-09-07
**Status:** accepted

## Context

A green scheduled run advanced `lastUpdated` while every lookup failed. The
shared measurements were three weeks old. Source inspection also found the
runtime fetch defaults to same-origin `/data`, despite ADR-0005 describing raw
GitHub. Preserve the current data origin and make its limits explicit.

## Decision

- An all-failed collector run exits nonzero without changing the data file.
  Partial success preserves old measurements and records success/failure counts.
- Display freshness from actual per-domain observations, not `lastUpdated`.
  Only a latest observation within 9 days and a baseline 5–9 days earlier can
  support a current weekly comparison. Historical rows remain available.
- Keep same-origin deployed JSON as the current default and the existing public
  external-origin override. A dataset commit alone is not deployment proof.
- Supersede [ADR-0005](0005-dual-data-sources.md)'s current-runtime assumption;
  its historical design rationale is retained.

## Consequences

Historical evidence remains useful while stale, partial or unavailable evidence
cannot look current. Existing production copies need a separately authorized
deployment; this repair does not change provider credentials or obtain fresh data.
