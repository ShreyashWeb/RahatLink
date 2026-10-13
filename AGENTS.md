# AGENTS.md: context for AI coding agents

Project: RahatLink, an offline-first app that detects who went silent (missed check-ins) in disasters and daily life, clusters and ranks silent households, and lets a coordinator approve volunteer dispatch.

Read `docs/PRD.md` (what), `docs/TRD.md` (how), `docs/THEME.md` (look), `docs/TASKS.md` (what is next), `docs/WORKFLOW.md` (rules).

Hard rules:
1. Must work offline on a local network (React PWA, IndexedDB, Yjs + y-webrtc, Node hub). No cloud, no paid APIs.
2. Humans decide: the system suggests, a coordinator approves.
3. Privacy: consent-based health profile, separate doc, local-only, volunteer sees nothing medical until they accept, access expires and is logged, break-glass needs a logged reason.
4. All demo data is simulated and labelled. Never hard-code result numbers; compute them.
5. Bluetooth mesh and real SMS are out of scope (roadmap/simulated).
6. Keep logic pure and tested in `packages/core`. Use TypeScript.
7. After each task, list changed files and how to verify.
