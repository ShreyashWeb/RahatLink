# RahatLink: 3-Minute Live Demo Script

> **Tagline**: *"Other apps wait for an SOS. RahatLink notices who went silent."*  
> **Team**: CodeForge | **Event**: SRIJAN 2K26  
> **Target Audience**: Judges, Disaster Coordinators, Community Volunteers  
> **Pre-requisite Setup**: Under 3 minutes (see [Quickstart](#5-minute-setup-for-new-teammates))

---

## ⏱️ Timeline & Click Path Overview

```
[0:00 - 0:20] The Problem: Reactive SOS vs Proactive Silence
[0:20 - 0:40] Go Offline: Zero Internet, Local Hotspot Sync
[0:40 - 1:00] Normal Day: Peacetime Check-ins & Consent Setup
[1:00 - 1:20] Flood Hits: Disaster Mode ON, Grace Windows Shrink
[1:20 - 1:50] The Cluster: 6 Households Silent, Ranked Before Any SOS
[1:50 - 2:30] Human in the Loop: "Why this score?", Dispatch, Briefing Unlocked
[2:30 - 2:45] Triage & Resilience: False Alarm Cleared via "Seen Safe"
[2:45 - 3:00] Measured Proof: Hard Metrics (Simulated) & Vision Tagline
```

---

## 🎭 Step-by-Step Demo Flow

### 1. (0:00 - 0:20) The Core Problem
- **What to show**: Hold up phone or open `http://localhost:5173/` on Coordinator Screen.
- **Presenter says**:
  > *"In a disaster — whether it's the Wayanad landslides, Chennai floods, or Yamuna overflow — phone towers drop, battery drains, and water rises fast. Every emergency app in the world requires you to press an SOS button. But what if you are unconscious, trapped on your roof without a charger, or an elderly resident who doesn't use a smartphone? You can't press SOS. Traditional systems assume silence equals safety. RahatLink flips the paradigm: **silence is the emergency signal**."*

---

### 2. (0:20 - 0:40) Go Offline on Hotspot
- **Action / Click path**:
  1. Open browser DevTools or show laptop disconnected from internet / on mobile hotspot.
  2. Point to the top banner: **🟢 Offline Hub Connected (ws://localhost:4444)**.
  3. Show the **"Offline Ready"** PWA badge and peer sync counter.
- **Presenter says**:
  > *"Notice right here: zero cloud dependency. RahatLink runs entirely offline over peer-to-peer WebRTC and a portable, battery-powered local Node hub. No AWS, no paid Google Maps API, no cellular data required. IndexedDB stores state locally and Yjs syncs conflict-free across phones in milliseconds."*

---

### 3. (0:40 - 1:00) Peacetime Daily Check-Ins
- **Action / Click path**:
  1. Switch to **Resident** view (`/resident`).
  2. Tap **"I am Safe Today"** (green check-in button). Show immediate haptic/visual ripple.
  3. Show the **Consent & Medical Vault**:
     - Point to *"Consent: Yes"* for medical profile (e.g. *Type-1 Diabetes, Insulin in Fridge, Ground Floor*).
     - Point to Privacy Notice: *"Stored encrypted on your phone. Never broadcast to coordinators or volunteers until dispatch approval."*
- **Presenter says**:
  > *"In peacetime, RahatLink is a daily elder safety habit. A single tap each morning confirms wellness. Crucially, sensitive health details are kept strictly in a private local vault with granular opt-in consent. No one snoops on your medical data during normal life."*

---

### 4. (1:00 - 1:20) Flood Hits — Disaster Mode Activated
- **Action / Click path**:
  1. Switch to **Coordinator** screen (`/coordinator`).
  2. In the top command header, toggle **"Disaster Mode"** to `ACTIVE`.
  3. Point to the yellow/orange emergency status badge and grace period indicator:
     - Normal grace: 24h $\to$ Disaster grace: **12h (0.5x multiplier)**.
- **Presenter says**:
  > *"A flash flood alert sounds. The coordinator turns Disaster Mode ON. Instantly, across the local mesh, check-in grace intervals shrink by 50%. The silence detection ladder shifts from relaxed checks to rapid triage."*

---

### 5. (1:20 - 1:50) The Cluster: 6 Households Silent Before Any SOS
- **Action / Click path**:
  1. Point to the live leaflet map.
  2. Point to **Cluster #1 (Riverside Sector 4)**: 6 orange and red markers huddled together near the water edge.
  3. Show the **Active Clusters** card:
     - *Cluster A: 6 households silent | Mean silence: 4.8h | High density (DBSCAN $\epsilon=300m$)*.
  4. Point out: **0 SOS messages were received**.
- **Presenter says**:
  > *"Look at the map. Zero SOS calls have come through the network. But RahatLink's density-based DBSCAN spatial engine already grouped 6 neighbouring houses whose check-ins lapsed together. While other rescue teams are still waiting for 112 calls, our coordinator already knows Sector 4 has suffered a localized cutoff."*

---

### 6. (1:50 - 2:30) Human-in-the-Loop & Tiered Privacy
- **Action / Click path**:
  1. In the Priority Queue, click on **HH-104 (Sharma Family, Score: 88 - CRITICAL)**.
  2. Click **"Why this score?"** drawer:
     - Show transparent heuristic breakdown:
       - *Silence Ladder (Critical, >2x grace): +40*
       - *Flood Hazard Zone (Riverside Tier 1): +25*
       - *Spatial Cluster Member (Cluster A): +15*
       - *Consented Medical Need (Insulin-dependent elderly): +8*
       - *Total: 88/100*
  3. Click **"Approve & Dispatch"**.
  4. Select volunteer **"Pooja Rao (Boat + First Aid)"** $\to$ click **"Dispatch"**.
  5. Switch to **Volunteer** screen (`/volunteer`):
     - Accept task: Tap **"Accept & Unlock Briefing"**.
     - Show unlocked mission card: Address, coordinates, access timer (expires in 60m), and medical note: *"Insulin-dependent, needs dry ice / refrigeration"*.
  6. Point to the Audit Log: *"Access logged: ID #vol-3 unlocked HH-104 health note at 10:14"*.
- **Presenter says**:
  > *"AI and heuristics never deploy volunteers autonomously — a human coordinator always reviews and approves. Notice our tiered privacy: Volunteer Pooja saw zero medical data until she explicitly accepted the task. Every view is time-boxed and logged to an immutable local audit trail."*

---

### 7. (2:30 - 2:45) False Alarm Cleared via "Seen Safe"
- **Action / Click path**:
  1. Back on Coordinator Screen, locate **HH-107 (Gupta Residence, Score: 52 - Elevated)**.
  2. Open Report / Neighbour Proxy modal or tap **"Mark Seen Safe"**.
  3. Enter reason: *"Neighbour Suresh verified in person — phone battery died, family is dry and safe"*.
  4. Click **"Confirm Seen Safe"**.
  5. Watch the silence score drop to **0 (Safe)** and marker return to green.
- **Presenter says**:
  > *"What about false alarms? Dead batteries happen. A neighbour or volunteer can file a 'Seen Safe' proxy check-in with a logged reason. The household resets immediately, clearing the queue so rescue boats aren't wasted."*

---

### 8. (2:45 - 3:00) Measured Results & The Big Close
- **Action / Click path**:
  1. Open the **Simulation & Metrics** tab (`npm run sim:measure` summary on screen).
  2. Highlight the measured benchmark banner (*Labelled: SIMULATED BENCHMARK*):
     - **Time to First Cluster Alert**: *14.2 minutes* (vs ~75+ mins typical for first 112 call).
     - **Report Triage Deduplication**: *82% noise/duplicate reduction*.
     - **Bandwidth**: *< 42 KB/min* Yjs sync delta.
  3. Close with clear delivery:
- **Presenter says**:
  > *"Every minute in a flood is the difference between rescue and tragedy.  
  > **Other apps wait for an SOS. RahatLink notices who went silent.**  
  > Thank you."*

---

## ⚡ 5-Minute Setup for New Teammates

Follow these exact steps on any Windows, macOS, or Linux machine:

```bash
# 1. Clone & install dependencies
git clone https://github.com/ShreyashWeb/RahatLink.git
cd RahatLink
npm install

# 2. Run unit tests to verify local environment (84 tests, 0 failures)
npm test

# 3. Start the Offline Hub and Web App in parallel
# Terminal 1: Local Hub (port 4444)
npm run hub

# Terminal 2: Vite Web Client (port 5173)
npm run dev

# 4. (Optional) Run the automated Playwright hero verification
npm run test:e2e

# 5. (Demo day shortcut) Seed realistic Riverside flood scenario
npm run sim:fast
```

Open your browser to:
- **Coordinator Dashboard**: `http://localhost:5173/` (or click top nav "Coordinator")
- **Resident Portal**: `http://localhost:5173/resident`
- **Volunteer Console**: `http://localhost:5173/volunteer`
