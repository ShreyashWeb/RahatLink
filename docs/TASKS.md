# TASKS: Build checklist (check off in order)

Rule: finish each task's acceptance check before moving on. Commit after every task.

## Phase 1: Foundation (hours 0-8)
- [x] T1 Monorepo scaffold, types, README (Prompt 1). Check: `npm run dev` runs web and hub; `npm test` passes.
- [x] T2 Offline data layer, Yjs, IndexedDB, WebRTC, hub (Prompt 2). Check: two windows sync; offline edits converge.
- [x] T3 Resident and neighbour screens, check-in, SOS, settings (Prompt 3). Check: check-in on phone shows on coordinator instantly.
- [x] T4 Silence engine and ladder, hub job, fast-forward clock (Prompt 4). Check: tests pass; ladder walks in about a minute at 60x.
- [x] T5 DBSCAN and risk score with breakdown (Prompt 5). Check: lone miss LOW; clustered insulin-dependent near flood HIGH.

## Phase 2: Product (hours 8-18)
- [x] T6 Coordinator dashboard: map, ranked list, approve/override/seen safe (Prompt 6).
- [x] T7 Volunteer app and matching (Prompt 7). Check: no sensitive data before accept.
- [x] T8 Health profile, consent, tiered briefing, log, break-glass, delete (Prompt 8). Check: 403 before accept, works after, rejected after resolve.
- [x] T9 SMS parser, triage screen, QR sync (Prompt 9). Check: Hinglish NLP extracts needs & urgency; QR stream merges tasks.

## Phase 3: Proof and polish (hours 18-24)
- [x] T10 Flood simulator and measure mode (Prompt 10). Check: identical numbers on re-run; writes results/sim_results.csv.
- [x] T11 PWA, offline hardening, accessibility, visual polish (Prompt 11). Check: airplane mode works after first load.

## Phase 4: Ship (last 6 hours, no new features)
- [ ] T12 Tests, Playwright hero flow, DEMO.md, JUDGES_QA.md (Prompt 12).
- [ ] T13 Rehearse the 3-minute demo twice on real phones and hotspot.
- [ ] T14 Final README, screenshots, team names, tag release.

## Cut list (in order)
OR-Tools, QR sync, Hindi labels, optional 3D view. Never cut: hero flow, privacy model, simulator.

## Bug log
| # | Issue | Owner | Status |
|---|---|---|---|
