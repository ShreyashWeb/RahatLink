# TRD: RahatLink (Technical Requirements)

## 1. Stack
React + Vite + TypeScript + Tailwind, PWA (vite-plugin-pwa), react-leaflet; Yjs, y-indexeddb, y-webrtc; Node.js hub (TypeScript); Vitest; Playwright (hero-flow e2e). Optional: Google OR-Tools script.

## 2. Architecture
Resident, neighbour and volunteer PWAs sync with a coordinator hub on a local network (hotspot or campus Wi-Fi). Each device keeps data in IndexedDB and merges changes via Yjs CRDT, so it works offline and converges on reconnect. The hub runs the signaling server, holds a full copy, and runs the detection engine headless every 30 s. Health data lives in a separate Yjs doc that is not shared with volunteer devices.

## 3. Data model (packages/core/src/types.ts)
Household, HealthProfile, CheckIn, Report, Volunteer, Task, AccessLogEntry, FloodZone, Settings (see build prompt 1 for fields).
Household.status: ok | due | grace | reminded | pinged | flagged | seenSafe.
Task.status: suggested | approved | accepted | resolved | cancelled | overridden.

## 4. Algorithms
**Silence ladder** (cadence 24 h, effectiveGrace = graceHours*60 min, times disasterGraceFactor in disaster mode):
t<24h ok; then due for 0.25*grace; grace until 24h+grace; reminded 0.25*grace; pinged 0.25*grace; then flagged. seenSafe resets the clock. Battery <=5% at last check-in sets likelyDeadPhone (lower urgency weight, still surfaced).

**Clustering:** DBSCAN on flagged households, haversine metres, default eps 150 m, minPts 2, tunable.

**Risk score (0-100, tunable weights):** silence beyond grace 25, cluster size 20, medical vulnerability 25 (only with consent), flood-zone distance 15, battery 5, corroborating reports 10. Tiers: >=70 HIGH, 40-69 MEDIUM, <40 LOW. A lone miss with no other factor must be LOW. Each factor renders as a sentence, for example "5 of 6 neighbours also silent (+20)".

**Matching:** fit = skills + equipment + proximity - unavailable penalty; greedy global assignment avoids double-booking; optional OR-Tools comparison.

**SMS parser:** rule-based Hinglish and English: urgency, need type, people count, location hint with fuzzy matching, confidence.

## 5. Access control (canView(role, field, taskState))
| Field | Resident | Coordinator | Volunteer before accept | Volunteer after accept |
|---|---|---|---|---|
| Own data | Full | n/a | none | n/a |
| Risk level, key need | Full | Full | Tier and distance only | Full |
| Conditions | Full | Summary | Hidden | Full until resolved |
| Exact address, contact | Full | While incident open | Hidden | Full until resolved |
Expiry: on resolve or cancel, or max 6 h. Every unlock and view creates an AccessLogEntry. Break-glass needs a reason and is logged as such.

## 6. Hub API
| Endpoint | Purpose |
|---|---|
| ws signaling :4444 | y-webrtc signaling |
| POST /sms {from,text} | Simulated SMS ingestion, returns parsed report |
| POST /briefing/unlock {taskId,volunteerId} | Verifies approved and assigned, returns briefing, logs, 403 otherwise |
| POST /briefing/break-glass {taskId,reason} | Coordinator only, logged |
All write endpoints need a shared demo secret header. No health data in logs.

## 7. Offline and performance
Precache app shell and demo-area map tiles; lazy-load the map; virtualise lists; batch Yjs observer updates with requestAnimationFrame; show last-synced time; retry hub connection with backoff.

## 8. Simulation (scripts/simulate.ts)
Fixed seed. 40 households, 2 flood zones, 8 volunteers, 6 consented profiles, about 6 silent neighbours, isolated false-alarm misses, about 60 messy SMS-style reports. Modes: live, fast (60x), measure (headless, writes results/sim_results.csv). Metrics computed, never hard-coded, labelled simulated.

## 9. Testing
Vitest for ladder boundaries, DBSCAN edge cases, score tiers, access matrix, parser, QR chunking, matching. Playwright for the hero flow. Lighthouse offline PWA check.

## 10. Security and privacy
Local-only data, no third-party trackers or cloud calls, consent gating, deletion and export, access log, demo secret header, roles stored locally (demo-grade, not production auth).

## 11. Known limits
Demo-grade authentication; coarse GPS indoors; heuristic score not validated on real events; SMS and Bluetooth mesh not implemented for real.
