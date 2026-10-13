# RahatLink: build prompts (paste into Claude Code, Cursor, Copilot, etc.)

Team CodeForge | SRIJAN 2K26 | Open Innovation

How to use: paste **Prompt 0** first in every new chat/session (it is the shared context). Then run Prompts 1 to 12 in order, one per session or one after another. After each prompt, run the app and fix errors before moving on. Each prompt ends with an "Acceptance check" you can verify yourself.

Rule for the whole build: the demo must work **offline on one hotspot / campus Wi-Fi with no internet**. All data in the demo is **simulated and labelled as simulated**. Never claim real-world results.

---

## Prompt 0: Master context (paste first, every time)

```
You are helping me build "RahatLink", a hackathon project (24-36 hours, team of 3-4 students).

PROBLEM
In disasters (floods, earthquakes) and everyday life, elderly, chronically ill, trapped or phone-less people cannot send an SOS. Existing SOS apps wait for the victim to call. RahatLink flips this: it notices WHO WENT SILENT. A missed daily check-in is the signal.

CORE IDEAS (must all be reflected in the code)
1. Daily one-tap "I'm okay" check-in per household. A neighbour can check in on behalf of someone without a smartphone (neighbour proxy).
2. Silence detection with an escalation ladder: check-in due -> grace window -> reminder -> neighbour ping -> flagged. The grace window is configurable per household (for example 24 h or 12 h) and is shortened automatically in "disaster mode".
3. Spatial clustering: silent households are grouped with DBSCAN. A lone missed check-in stays low priority; a cluster of nearby silent homes raises priority.
4. Weighted risk score with a visible breakdown. Inputs: silence duration vs grace window, cluster size, medical vulnerability (consented), distance to flood zone, last battery level, corroborating reports. Output tiers: HIGH / MEDIUM / LOW. The weights are tunable.
5. Human in the loop: the system only SUGGESTS. A coordinator approves, overrides, or marks "seen safe". Every dispatch needs approval.
6. Volunteer dispatch matching on skills, equipment and distance (greedy or Google OR-Tools).
7. Consent-based health profile (conditions like diabetes, asthma, insulin dependence, mobility, allergies). Tiered access: before a volunteer accepts a task they see only the risk level and key need; after accepting they see the full briefing; access expires when the task is resolved; every view is written to an access log; a break-glass option exists for unconscious victims with a mandatory logged reason. Health data stays on the local hub, never in the cloud. Self-reported facts only, never medical advice.
8. Offline-first: React PWA, IndexedDB on each device, Yjs CRDT + y-webrtc sync over a local network, a Node.js hub on a laptop. No internet needed.
9. Fallbacks when data is poor: (a) an SMS report parsed by the hub with a rule-based Hinglish/English parser, (b) QR-code sync carried by volunteers. Bluetooth mesh is ROADMAP ONLY, do not build it.
10. Peacetime value: daily elder check-ins give people a reason to use the app before a disaster.

TECH STACK
- Frontend: React + Vite + TypeScript, PWA (service worker, manifest), Leaflet maps (react-leaflet), Tailwind CSS.
- Sync/data: Yjs documents, y-webrtc (and y-indexeddb for persistence), Node.js hub with a small signaling server (y-webrtc signaling) plus a simple HTTP endpoint for SMS-report ingestion.
- Logic: TypeScript modules that run in the browser and on the hub (shared package).
- Clustering: implement DBSCAN in TypeScript (haversine distance), no cloud calls.
- Matching: greedy scoring first; optionally OR-Tools via a Node/Python script later.
- Tests: Vitest for pure logic.

REPO LAYOUT TARGET
/apps/web (PWA), /apps/hub (Node hub), /packages/core (types, scoring, clustering, silence engine, matcher, parser), /scripts (simulator)

CONSTRAINTS
- Work offline. No paid APIs. No real SMS gateway (SMS is simulated by posting text to the hub).
- All demo data is clearly labelled "Simulated".
- Keep code readable, typed, and commented where logic is non-obvious. Prefer small pure functions that are unit-testable.
- When you finish a task, list the files you created or changed and how to run and verify it.

Acknowledge this context in 5 lines, then wait for the specific task prompt.
```

---

## Prompt 1: Scaffold the monorepo

```
Using the RahatLink context, scaffold the project.

1. Create an npm workspaces monorepo: apps/web (React + Vite + TypeScript + Tailwind, PWA via vite-plugin-pwa), apps/hub (Node.js + TypeScript, ts-node/tsx), packages/core (TypeScript library, built with tsup or plain tsc, consumed by both apps).
2. Add scripts at the root: `dev:web`, `dev:hub`, `dev` (runs both), `test` (Vitest in core).
3. In packages/core/src/types.ts define the data model exactly:
   - Household { id, name, lat, lng, address, floor, contactPhone, householdSize, hasSmartphone, graceHours, lastCheckInAt, lastBattery?, proxyNeighbourId?, consent: { health: boolean, grantedAt?: string }, status: 'ok'|'due'|'grace'|'reminded'|'pinged'|'flagged'|'seenSafe' }
   - HealthProfile { householdId, conditions: string[] (e.g. 'diabetes','asthma','insulin-dependent','limited-mobility'), allergies: string[], medications?: string, notes?: string, updatedAt }
   - CheckIn { id, householdId, at, by: 'self'|'neighbour', batteryPct? }
   - Report { id, at, lat?, lng?, text, source: 'sms'|'app', parsed?: { type, urgency, needs[], matchedHouseholdId? } }
   - Volunteer { id, name, skills: string[] (e.g. 'first-aid','boat','medical'), equipment: string[], lat, lng, available: boolean }
   - Task { id, householdIds: string[], riskTier, score, breakdown, status: 'suggested'|'approved'|'accepted'|'resolved'|'cancelled'|'overridden', volunteerId?, approvedBy?, createdAt, resolvedAt? }
   - AccessLogEntry { id, at, actor, role, householdId, field, action: 'view'|'break-glass', reason? }
   - FloodZone { id, name, polygon: [lat,lng][] }
   - Settings { disasterMode: boolean, disasterGraceFactor: number, weights: {...} }
4. Export everything from packages/core/src/index.ts. Add a Vitest smoke test.
5. Create README with run instructions.

Acceptance check: `npm install`, `npm run dev` starts web on :5173 and hub on :4444 with no errors; `npm test` passes; web imports a type from @rahatlink/core.
```

---

## Prompt 2: Offline data layer and CRDT sync

```
Implement the offline-first data layer.

In apps/web/src/store:
1. Create one Yjs Y.Doc with top-level maps/arrays: households (Y.Map keyed by id), checkIns (Y.Array), reports (Y.Array), volunteers (Y.Map), tasks (Y.Map), accessLog (Y.Array), settings (Y.Map), floodZones (Y.Array).
2. Persist with y-indexeddb so the app loads fully with no network.
3. Sync with y-webrtc, room name 'rahatlink-demo', signaling servers configurable (default to the local hub ws://<hub-ip>:4444). Show a small status chip in the header: Offline / Syncing / Synced with count of connected peers.
4. Expose typed React hooks: useHouseholds(), useCheckIns(), useTasks(), useVolunteers(), useSettings(), plus mutation helpers (addCheckIn, upsertHousehold, updateTask, logAccess). Hooks must re-render on Yjs observe events.
5. Health data separation: HealthProfile records live in a SEPARATE Y.Doc ('health') that only the hub and coordinator role sync; resident devices only keep their own profile. Volunteer devices receive a health briefing only through an explicit, logged "unlock" message from the hub (implement the plumbing now with a stub; full logic in Prompt 8).
6. In apps/hub create a Node server that: runs the y-webrtc signaling server (y-webrtc/bin/server.js or the `y-webrtc-signaling` equivalent), and also hosts its own Yjs peer (y-websocket or y-webrtc peer in Node using `wrtc`-free websocket provider) so the hub always holds a full copy and can run the detection engine headless. Persist the hub doc to a local file (leveldb or a binary snapshot every 10 s).

Acceptance check: open the web app in two browser windows (and a phone on the same Wi-Fi). Add a check-in in one; it appears in the other within 1-2 seconds. Disconnect Wi-Fi, make edits on both, reconnect, and both converge without data loss. Reloading while offline still loads data.
```

---

## Prompt 3: Check-in flows (resident + neighbour proxy) and daily-use screens

```
Build the resident-facing screens in apps/web (mobile-first, large touch targets, works in low light, supports English and Hindi labels via a tiny i18n map).

1. Onboarding: choose role (Resident / Neighbour / Volunteer / Coordinator). Residents create or select a household: name, address, tap-on-map to set location, household size, grace window (12 h / 24 h / 48 h), smartphone yes/no, optional neighbour proxy.
2. Home screen for residents: one huge "I'm okay" button. On tap, write a CheckIn, update household.lastCheckInAt, set status 'ok', record navigator.getBattery() level when available, show a friendly confirmation and the next-due time.
3. Neighbour proxy screen: list of households I look after; each has an "I saw them / they're okay" button that creates a CheckIn with by:'neighbour'. Also a "Can't reach them" button that creates a note and nudges the escalation.
4. Peacetime value features: streak counter, "family can see you checked in" is OUT of scope; keep a simple history list of the last 7 check-ins.
5. SOS button on the resident screen (secondary): creates a Report with source 'app' and current location. This is the fallback for people who CAN ask for help; RahatLink's core value is detecting those who cannot.
6. Settings page for coordinator only: disaster mode toggle, disaster grace factor (for example 0.5 = halve all grace windows), risk weights sliders.

Acceptance check: on two phones, resident taps "I'm okay", coordinator view updates instantly; neighbour proxy can check in for a no-smartphone household; history shows last 7 check-ins.
```

---

## Prompt 4: Silence detection engine and escalation ladder

```
Implement the silence engine as pure, tested code in packages/core/src/silence.ts and run it on the hub every 30 s (and in the browser for coordinator view).

Function: evaluateHousehold(h: Household, now: Date, settings: Settings): { status, minutesSilent, graceMinutes, nextStageAt }

Rules:
- effectiveGrace = h.graceHours * 60 minutes, multiplied by settings.disasterGraceFactor when settings.disasterMode is true.
- Check-in cadence is 24 h. Stage logic from time since lastCheckInAt (t):
  - t < 24 h: 'ok'
  - 24 h <= t < 24 h + 0.25*grace: 'due' (check-in due)
  - up to 24 h + grace: 'grace' (waiting period)
  - then 'reminded' (push/SMS reminder, simulated: write a notification record) for the next 0.25*grace
  - then 'pinged' (neighbour/volunteer asked to check in person) for the next 0.25*grace
  - after that: 'flagged' (enters clustering and risk scoring)
- 'seenSafe' status set by neighbour/volunteer/coordinator resets the clock and records who confirmed.
- If the last battery reading was <= 5% at the time of last check-in, mark `likelyDeadPhone: true` (a dead phone is different from no response) and lower urgency weight, but still surface it.
- Households with hasSmartphone=false depend on the neighbour proxy check-in.

Hub job: every 30 s read all households, compute status, write changes back to the Yjs doc, and create Notification entries for the 'reminded' and 'pinged' transitions (simulated, shown in a feed in the UI).

Write Vitest tests for: normal day, missed by 1 h, each stage boundary, disaster-mode shortening, seenSafe reset, dead-phone flag, no-smartphone household.

Acceptance check: tests pass; using a "fast-forward clock" dev control in the coordinator UI (multiplies time by 60x) I can watch a household walk the full ladder in about a minute.
```

---

## Prompt 5: DBSCAN clustering and the risk score

```
Implement clustering and risk scoring as pure, tested code.

packages/core/src/cluster.ts
- haversine(a, b) in metres.
- dbscan(points, epsMeters, minPts) -> cluster labels. Defaults: eps 150 m, minPts 2 (tunable in Settings). Only households with status 'flagged' (or 'pinged' optionally) are clustered. Return clusters with centroid, member ids, and cluster size; noise points are single silent households.

packages/core/src/risk.ts
- scoreHousehold(h, ctx): { score: 0-100, tier: 'HIGH'|'MEDIUM'|'LOW', breakdown: {factor, points, explanation}[] }
- Factors and default weights (tunable): silence beyond grace 25, cluster size 20, medical vulnerability 25 (only counted if consent.health is true and a profile exists; insulin-dependent, oxygen, limited-mobility score highest), distance to nearest flood zone 15 (closer = higher, use point-to-polygon distance), last battery level 5 (low battery increases concern but is shown separately), corroborating reports 10 (any parsed report within 200 m in the last 6 h).
- Tiers: >= 70 HIGH, 40-69 MEDIUM, < 40 LOW. A single isolated missed check-in with no other factors must come out LOW.
- Each breakdown item must read like a sentence: "5 of 6 neighbours also silent (+20)".
- Create a task suggestion per cluster (or per isolated household for MEDIUM and above) with status 'suggested', carrying the score and breakdown.

Tests: the isolated-miss case is LOW; the same household inside a silent cluster, insulin-dependent, 80 m from a flood zone, battery 4% becomes HIGH; consent=false hides medical points; weights change the tier.

Acceptance check: tests pass; `npm run sim:score` prints a table of 10 demo households with tiers and breakdowns. Label all output "illustrative / simulated".
```

---

## Prompt 6: Coordinator dashboard (map, ranked list, approvals)

```
Build the coordinator dashboard (desktop-first, also usable on a tablet).

1. Left: Leaflet map (OpenStreetMap tiles with a graceful offline fallback: a plain grid background plus cached tiles for the demo area; allow pre-downloading tiles for the demo neighbourhood). Draw flood zones as translucent polygons, households as markers coloured by status (ok green, due/grace amber, reminded/pinged orange, flagged red, seenSafe blue), silent clusters as translucent circles around the centroid, volunteers as distinct icons.
2. Right: ranked task list sorted by score. Each card shows tier badge, household(s), "silent X h, grace Y h", and a "Why this score?" expandable panel rendering the breakdown as bars + sentences.
3. Actions per task: Approve (opens volunteer matching modal), Override (choose tier, required reason), Seen safe (neighbour/volunteer confirmed, clears the flag and logs who), Cancel.
4. Top bar: disaster-mode toggle, sync status, fast-forward clock (dev), counts of flagged / approved / resolved, and a "Simulated data" ribbon when the simulator is running.
5. A banner reminding "RahatLink suggests. A coordinator decides."
6. Notifications feed (simulated reminders and neighbour pings).
7. An empty state and a loading state that look good.

Acceptance check: with the simulator running, flagged households appear on the map, the ranked list updates live, "Why this score?" explains every point, and Approve/Override/Seen safe change state and sync to a second open window.
```

---

## Prompt 7: Volunteer app and dispatch matching

```
Build the volunteer side and the matching engine.

packages/core/src/match.ts
- rankVolunteers(task, volunteers, households): returns volunteers sorted by a fit score = skills match (task needs from health tags: 'first-aid','medical','boat','mobility-assist') + equipment match + proximity (haversine) - unavailable penalty. Return fit breakdown too.
- assign(tasks, volunteers): greedy global assignment so one volunteer is not given two urgent tasks. Add an optional script scripts/ortools_assign.py that solves the same assignment with Google OR-Tools and a CLI flag to compare results; keep greedy as the default for the demo.

apps/web volunteer screens
1. Volunteer profile: name, skills, equipment, availability toggle, live location (manual pin if GPS is unavailable).
2. Task inbox: shows only APPROVED tasks assigned to me. Before accepting: risk tier, rough area, distance, estimated key need (for example "may need insulin support"), NO name, NO exact address, NO full medical details.
3. Accept / Decline. On Accept, call the hub to unlock the briefing (Prompt 8).
4. After accepting: navigation hint (open maps link with coordinates or a simple compass/distance view if offline), contact, floor, checklist, and a "Found them: resolved" button with a note, plus "Need backup".
5. Resolve closes the task, expires the briefing access, and writes to the access log.

Tests: skills/equipment/distance ranking; two urgent tasks, two volunteers, no double assignment.

Acceptance check: coordinator approves a HIGH task, picks the top-ranked volunteer, the volunteer phone shows the task without sensitive data, accepts, and the briefing appears.
```

---

## Prompt 8: Consent-based medical briefing with tiered access

```
Implement the privacy model carefully. This is a key judging point.

1. Health profile form (resident): conditions chips (diabetes, asthma, insulin-dependent, heart condition, limited mobility, pregnant, other), allergies, medications (optional), notes, and a clear plain-language consent toggle: "I agree to share this with an approved volunteer only after they accept a task for me." Show a "Delete my health data" button that removes the profile and records the deletion. Show "Download my data".
2. Storage: health data lives in the separate 'health' Y.Doc held by the hub and the resident's own device. It must NOT be in the shared main doc. Never send it to a server outside the local network.
3. Hub endpoint POST /briefing/unlock { taskId, volunteerId }: verifies the task is 'approved' and assigned to that volunteer, then returns a briefing payload and writes an AccessLogEntry (actor, role, householdId, fields, time). The unlock token expires when the task is resolved/cancelled or after a max duration (default 6 h).
4. Access matrix (implement as a single function canView(role, field, taskState)):
   - Resident: own data, always.
   - Coordinator: risk level and key needs always; conditions as a summary only; exact address/floor/contact only while an incident is open (for dispatch).
   - Volunteer before accept: nothing (risk tier and distance only).
   - Volunteer after accept: full briefing until the task is resolved.
5. Break-glass: if a victim is reported unconscious or unreachable and consent exists, the coordinator can release the briefing to the assigned volunteer by entering a mandatory reason; mark the log entry action 'break-glass'. If consent was NOT given, break-glass shows only non-medical location info and the log notes "no consent".
6. Access log screen (coordinator + resident view of their own entries): who viewed what and when.
7. Disclaimer text everywhere: "Self-reported by the resident. Not medical advice."
8. Unit-test canView for every role/state combination, and test that expired tokens are rejected.

Acceptance check: before accept, the volunteer cannot fetch health data (the request returns 403); after accept it works and is logged; after resolve it is rejected again; resident can see the log and delete their data.
```

---

## Prompt 9: Report triage (SMS fallback) and QR sync

```
Build the data-poor fallbacks.

1. SMS report ingestion: hub endpoint POST /sms { from, text } (simulated gateway). Write a rule-based Hinglish + English parser in packages/core/src/parse.ts that extracts: urgency (words like 'urgent', 'jaldi', 'turant', 'help', 'bachao'), need type (water, medical, rescue, food, 'phans gaye' = trapped), people count (digits or 'do', 'teen', 'paanch'...), a location hint (match against household/landmark names with fuzzy matching, accept "lat,lng" if present), and a confidence value. Create a Report, attach matchedHouseholdId when confident, and let the risk engine use it as a corroborating report.
2. Triage screen for the coordinator: list of parsed reports with the original text, parsed fields, confidence and a "link to household / ignore / create task" action.
3. QR sync: a "Share with a volunteer" button that encodes a compressed snapshot (Yjs update, deflate + base64, chunked into a sequence of QR codes) of the tasks and flagged households; a volunteer phone scans it with the camera (use a JS QR library) and merges the update into its Y.Doc. Include a progress UI for multi-part QR. Include the reverse: volunteer shows results back to the coordinator.
4. Clearly mark Bluetooth mesh as "Roadmap" in the UI roadmap page; do not implement it.

Tests: parse 15 messy sample messages including mixed Hindi-English and typos ("sector 5 me 3 log phans gaye, ek diabetic hai, jaldi"); QR chunk encode/decode round trip.

Acceptance check: posting a messy SMS with curl creates a parsed report that bumps a household's score; a QR round trip between two devices merges tasks.
```

---

## Prompt 10: Scripted flood simulator (for the demo and the proof slide)

```
Create scripts/simulate.ts: a scripted, repeatable, clearly-labelled SIMULATION used for the demo and for measuring prototype behaviour.

Scenario "Riverside flood" (fixed random seed so every run is the same):
- 40 households in a small neighbourhood with realistic coordinates, 2 flood zone polygons, 8 volunteers with varied skills/equipment, 6 households with consented health profiles (mix of diabetes, asthma, insulin-dependent, limited mobility).
- Timeline: normal day of check-ins -> disaster mode on -> about 6 neighbouring households stop checking in -> a few isolated misses elsewhere (false-alarm bait) -> about 60 messy SMS-style reports arrive (some duplicates, some irrelevant) -> one "seen safe" clears a false alarm.
- The script drives the Yjs doc through the hub (or writes directly with a fast-forward clock) so the UI reacts live.
- Run modes: `npm run sim` (live, real-time-ish), `npm run sim:fast` (60x), `npm run sim:measure` (headless).

Measurement mode must compute and print (and save to JSON/CSV) these metrics, always labelled "simulated scenario":
- Detection rate: trapped households that were flagged / total trapped.
- False alarms: flags on households that were actually fine, and how many were cleared by "seen safe".
- Time to flag: median minutes from the first missed check-in to the coordinator seeing a flag.
- Manual baseline: a simple comparison script that models a coordinator phoning households one by one at N calls/hour, for the same scenario.

Do not hard-code results; compute them. Add a README section "What this simulation does and does not prove".

Acceptance check: `npm run sim:measure` prints the four metrics and writes results/sim_results.csv; re-running gives identical numbers (fixed seed).
```

---

## Prompt 11: PWA polish, offline hardening, accessibility

```
Polish and harden the app.

1. PWA: manifest, icons, service worker precaching of the app shell and map tiles for the demo area, install prompt, offline page. Verify with Lighthouse offline test.
2. Performance on cheap phones: lazy-load the map, virtualise long lists, avoid re-render storms from Yjs observers (batch updates with requestAnimationFrame).
3. Accessibility: large tap targets, high-contrast theme, aria labels, readable status colours with icons/text (not colour alone), Hindi labels for key actions.
4. Resilience: handle Yjs sync conflicts gracefully, show "last synced" time, queue actions while offline, retry the hub connection with backoff.
5. Security basics for the demo: role selection stored locally, hub endpoints require a shared demo secret header, no health data in logs, no analytics/trackers.
6. Visual design pass (use a bold, calm, trustworthy look: navy + orange accent, consistent spacing, clear hierarchy). Add empty/loading/error states everywhere.
7. Add a "Roadmap" page listing: Bluetooth mesh transport, authority/NDRF integration, many-hub roll-ups, more languages.

Acceptance check: Lighthouse PWA passes; airplane mode works end to end after first load; two phones plus laptop demo on a single hotspot with no internet.
```

---

## Prompt 12: Tests, demo script, and judge Q&A

```
Finish with quality and presentation material.

1. Run the full Vitest suite and add missing tests for: silence ladder boundaries, clustering edge cases (duplicates, one point, all noise), score tiers, access matrix, parser, QR chunking. Report coverage for packages/core.
2. Add an end-to-end script (Playwright) for the hero flow: silence detected -> cluster flagged -> medical-aware score -> coordinator approves -> volunteer accepts -> briefing unlocks -> resolve -> access expires -> false alarm cleared with "seen safe".
3. Write DEMO.md: a 3-minute demo script with exact click path and timings: (0:00) problem, (0:20) go offline on hotspot, (0:40) normal day check-ins, (1:00) flood hits, disaster mode on, grace windows shrink, (1:20) about 6 neighbours go quiet, cluster flagged and ranked before any SOS, (1:50) coordinator opens "Why this score?", approves, volunteer accepts and briefing unlocks, (2:30) false alarm cleared by "seen safe", (2:45) measured simulation results labelled simulated, close with the one-line tagline: "Other apps wait for an SOS. RahatLink notices who went silent."
4. Write JUDGES_QA.md with short honest answers for: privacy (opt-in with consent, local-only, tiered access, log, delete), false alarms (risk scoring + human approval + seen safe), adoption (peacetime daily elder check-ins, neighbour proxy, works on existing phones), why not telecom data (needs operator access a community cannot get), what is real vs simulated, what is roadmap.
5. Produce a one-page architecture diagram in Mermaid inside README.md matching the slides: resident PWA, neighbour proxy, volunteer PWA <-> Coordinator hub (silence detector, DBSCAN clustering, risk engine, dispatch matcher, report triage, local store + access log), with SMS and QR fallbacks.

Acceptance check: a teammate who has never seen the project can run the demo from DEMO.md in under 5 minutes of setup.
```

---

## Handy "fix it" prompts

**When something breaks**
```
Here is the exact error and the file it comes from: <paste>. Explain the root cause in two lines, then give the minimal fix. Do not refactor unrelated code. Re-run the relevant test or command and show it passing.
```

**When Yjs sync misbehaves**
```
Audit my Yjs setup: list every Y.Doc, provider, room name and persistence layer in the repo, check for duplicate providers, missing destroy() on unmount, and observers that cause render loops. Propose fixes and apply them.
```

**When the UI looks plain**
```
Redesign this screen to look like a polished, trustworthy emergency-response product: navy (#0B1B3A) and orange (#F26A1B) palette, strong typographic hierarchy, generous spacing, clear status colours with icons, mobile-first. Keep all behaviour and tests intact. Show before/after screenshots using Playwright.
```

**When time is running out (cut list, in this order)**
1. Skip OR-Tools (keep greedy matching). 2. Skip QR sync (keep SMS parser). 3. Skip Hindi i18n. 4. Keep the hero flow, privacy model, and simulator; these win the demo.

---

## Suggested team split (3-4 people)

| Person | Prompts |
|---|---|
| A: Core logic | 4, 5, 7 (matching), 9 (parser) |
| B: Web/UI | 3, 6, 7 (volunteer UI), 11 |
| C: Sync and hub | 1, 2, 8, 9 (QR) |
| D: Demo and story | 10, 12, slides, rehearsal |

## Honesty reminders for the demo

- Say "simulated scenario" every time you show numbers.
- Say "SMS is simulated through the hub" and "Bluetooth mesh is on the roadmap".
- The risk score is a transparent weighted heuristic with a human approving it, not a trained model.
