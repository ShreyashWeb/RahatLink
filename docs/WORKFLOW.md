# WORKFLOW: How we build with AI

## Roles (3-4 people)
A Core logic (silence, clustering, score, matcher, parser). B Web/UI (screens, map, polish). C Sync and hub (Yjs, hub, privacy endpoints, QR). D Demo and story (simulator, slides, rehearsal, docs).

## Daily loop
1. Pick the next unchecked task in `TASKS.md`.
2. Open a fresh AI chat. Paste Prompt 0 (or let the tool read `AGENTS.md`), then the task's prompt from `RahatLink_build_prompts.md`.
3. Let the AI implement. Read the diff; do not merge code nobody understands.
4. Run it. Check the task's acceptance line. Paste exact errors back to the AI.
5. Commit with a clear message. Tick the task. Log bugs in `TASKS.md`.

## Git
`main` is always demo-ready. Branch per task: `feat/t4-silence-engine`. Small commits. Merge only after the acceptance check passes. Tag `demo-v1` before rehearsal.

## Definition of done
Works offline; tests pass; no console errors; simulated data labelled; privacy rules intact; screenshot added for the README.

## Rules for AI-generated code
- No online-only dependencies or CDNs in the demo path.
- No health data in the shared doc or logs.
- Numbers shown to judges are computed by the simulator, never hard-coded.
- Pure logic stays in `packages/core` with tests.

## Timeline (about 30 h)
0-8 h T1-T5 | 8-18 h T6-T9 | 18-24 h T10-T11 | last 6 h T12-T14, bug fixes only.

## Demo day checklist
Phones charged; hotspot tested; app installed as PWA and loaded once; airplane-mode test done; sim seed fixed; DEMO.md rehearsed twice; backup screen recording; slides PDF on two devices.

## Honesty checklist
Say "simulated" with every number; say SMS is simulated; say mesh is roadmap; call the score a transparent heuristic with human approval.
