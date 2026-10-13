# RahatLink: Judges' Q&A Cheat Sheet

> **Event**: SRIJAN 2K26 | **Team**: CodeForge  
> **Tagline**: *"Other apps wait for an SOS. RahatLink notices who went silent."*

---

### Q1. Privacy & Medical Data: How do you protect health profiles under the DPDP Act?
**Answer:**
1. **Explicit Opt-in Consent**: Medical details (e.g. insulin dependence, asthma, wheelchair use) are strictly opt-in (`consent.health = true`). Without consent, medical risk heuristic points are completely suppressed (`+0`).
2. **Local-Only Storage**: Health profiles reside exclusively in the resident's private local Y.Doc / IndexedDB vault. They are never broadcast over WebRTC rooms during peacetime.
3. **Tiered Access (Need-to-Know)**: Before dispatch acceptance, volunteers see only rough neighborhood proximity (~250m) and generalized needs ("May need medical assistance"). Exact names, flat numbers, and health dossiers remain locked.
4. **Acceptance-Gated & Time-Boxed**: Health details unlock only after a volunteer taps *"Accept & Unlock Briefing"*. Access automatically expires when the mission is marked resolved or after 60 minutes.
5. **Immutable Local Audit Log**: Every view or break-glass access generates a signed entry (`actor`, `role`, `timestamp`, `reason`, `householdId`).
6. **Right to Erasure**: Residents can toggle consent off or delete their health record instantly with a single tap, purging it from local storage.

---

### Q2. False Alarms: A dead phone or forgotten check-in isn't always an emergency. How do you avoid panic and wasted rescue resources?
**Answer:**
1. **Multi-Factor Risk Scoring (Not a Binary Trigger)**: A single missed check-in does not dispatch a rescue boat. Risk is computed transparently across:
   - **Silence Escalation Ladder** (Grace period $\to$ Pending $\to$ Flagged $\to$ Critical).
   - **Hazard Exposure** (Intersection with active flood polygons).
   - **Spatial Density (DBSCAN)** (Are neighboring houses also silent?).
   - **Consented Vulnerabilities** (Elderly, mobility impaired).
2. **Human-in-the-Loop Governance (Hard Rule #2)**: The algorithm only *suggests* priority; human coordinators review and click *Approve*. Volunteers are never dispatched autonomously.
3. **"Seen Safe" Proxy Reset**: If an elder's battery dies but their neighbor verifies them in person, anyone can submit a *"Seen Safe"* proxy check-in with a logged reason. The household immediately drops back to Green (Safe), clearing the queue without dispatching emergency services.

---

### Q3. Adoption & Cold Start: If people only install this during a flood, it's too late. Why would anyone install RahatLink?
**Answer:**
1. **Peacetime Utility (Daily Elder Care)**: RahatLink isn't just a disaster app; it is a daily habit. Families and Resident Welfare Associations (RWAs) use it every morning for simple 1-tap elder safety check-ins. When disaster strikes, the network already exists.
2. **Neighbour Proxy Pattern**: Over 40% of vulnerable elders in Indian urban colonies and rural villages do not own smartphones. Neighbors or Asha workers register them and perform proxy check-ins on their behalf.
3. **Zero App Store Friction (PWA)**: Works on any standard browser (Android Chrome, iOS Safari, KaiOS) via a lightweight Progressive Web App. Pre-caches offline shell and map tiles. No 100 MB app store download required.

---

### Q4. Why not just use Telecom / CDR Cell Tower Data?
**Answer:**
1. **Community Inaccessibility**: Telco CDR (Call Detail Record) and HLR/VLR tower dump data are legally restricted and accessible only to state intelligence and defense agencies under warrant. Community coordinators, ward corporators, and volunteer rescue teams cannot access live carrier logs.
2. **Towers Fail in Disasters**: During severe floods, cyclones, or earthquakes, telecom towers lose grid power, backhaul fiber snaps, or batteries drown. In a cellular blackout, CDR data is completely blind.
3. **Granularity**: A cell tower ping has a radius of 500m to 3km. It cannot tell you which ground-floor diabetic resident in Lane 4 is trapped under rising flood water. RahatLink operates at household-level precision over local WiFi/hotspot meshes.

---

### Q5. What is Real vs Simulated in this Prototype?
**Answer:**

| Component | Status | Implementation Details |
| :--- | :--- | :--- |
| **Silence Detection Engine** | **REAL** | Pure TypeScript state machine in `@rahatlink/core/src/silence.ts` with test coverage. |
| **DBSCAN Spatial Clustering** | **REAL** | Custom density clustering in `@rahatlink/core/src/cluster.ts` grouping silent households by geo-distance ($\epsilon, minPts$). |
| **Heuristic Risk Scorer** | **REAL** | Multi-factor weighted evaluation (0-100) with explainable factor breakdowns. |
| **Local Offline Sync** | **REAL** | Yjs CRDT + `y-indexeddb` + local WebSocket hub (`apps/hub`) running on port 4444. |
| **PWA & Offline Maps** | **REAL** | Service worker shell caching, Leaflet map tiles, offline fallback page. |
| **DPDP Privacy Guard** | **REAL** | Role-based token gating, 60m expiry, audit log, break-glass reason logger. |
| **SMS Ingestion** | **SIMULATED** | Gateway parser and deduplication logic are real; GSM carrier modem hardware is mocked via REST/mock ingestion. |
| **Demo Households & Floods** | **SIMULATED** | 40 synthetic households and Lucknow Gomti flood polygons generated via seeded pseudo-random simulation (`scripts/simulate.ts`). |
| **Bluetooth Mesh Transport** | **ROADMAP** | BLE GATT payload structures designed (see `docs/TRD.md`), currently bridged over WebRTC / Wi-Fi mesh. |

---

### Q6. What is on the Future Roadmap?
**Answer:**
1. **Bluetooth Low Energy (BLE) Mesh Daemon**: Native background Android/Linux service using BLE advertisement packets to relay 32-byte compressed check-in pulses without Wi-Fi.
2. **NDRF & CAP-India Integration**: Bidirectional export to Common Alerting Protocol (CAP) and Government disaster response dashboards.
3. **Multi-Hub Hierarchical Roll-Up**: Inter-colony drone-carried "data mules" syncing district-level hubs when all bridges and roads are cut off.
4. **Voice & Vernacular Support**: Conversational IVR and voice check-ins in Hindi, Bhojpuri, Tamil, and Bengali for non-literate residents.
