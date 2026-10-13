# PRD: RahatLink (Product Requirements)

## 1. Problem
In floods, earthquakes and everyday emergencies, elderly, chronically ill, trapped or phone-less people often cannot send an SOS. SOS and relief apps wait for the victim to ask. Telecom-based silence detection exists in research but needs operator data a community cannot access. Rescue effort goes to people who can call, and silent victims are missed.

## 2. Vision
Rescue that starts from silence: notice who stopped checking in, rank them fairly, and send the right volunteer with the right information, while keeping a human in control and the person's data private.

## 3. Users
| User | Need |
|---|---|
| Resident (elderly, ill, living alone) | A 1-tap way to say "I'm okay"; control over their health data |
| Neighbour proxy | Check in for someone without a smartphone |
| Volunteer | Clear, safe tasks with only the information they need, when they need it |
| Coordinator | One map, a ranked list, and a clear reason for each score; final say on dispatch |

## 4. Goals and non-goals
Goals: detect silence early, reduce false alarms, work offline, protect health data, be usable on cheap phones.
Non-goals: real telecom integration, real SMS gateway, medical advice, Bluetooth mesh (roadmap), replacing emergency services.

## 5. Features (MVP)
| ID | Feature | Priority |
|---|---|---|
| F1 | Daily 1-tap check-in, neighbour proxy check-in | Must |
| F2 | Silence engine with escalation ladder and configurable grace window, shortened in disaster mode | Must |
| F3 | DBSCAN clustering of silent households | Must |
| F4 | Weighted risk score with visible breakdown, HIGH/MEDIUM/LOW | Must |
| F5 | Coordinator dashboard: map, ranked tasks, approve / override / seen safe | Must |
| F6 | Volunteer app and dispatch matching (skills, equipment, distance) | Must |
| F7 | Consent-based health profile with tiered access, expiry, access log, break-glass | Must |
| F8 | Offline-first sync (PWA, IndexedDB, Yjs + WebRTC, local hub) | Must |
| F9 | SMS report parsing (Hinglish + English), triage screen | Should |
| F10 | QR-code sync via volunteers | Should |
| F11 | Scripted flood simulator with computed metrics | Must (for proof) |
| F12 | Hindi labels | Could |
| F13 | OR-Tools assignment | Could |
| F14 | Bluetooth mesh, authority integration, multi-hub roll-up | Roadmap |

## 6. Key user flows
1. **Daily:** resident taps "I'm okay" -> status ok -> next due in 24 h.
2. **Silence:** check-in missed -> grace window -> reminder -> neighbour ping -> flagged.
3. **Rescue:** cluster flagged -> risk score -> coordinator sees "why" -> approves -> matcher picks volunteer -> volunteer accepts -> briefing unlocks -> resolved -> access expires.
4. **False alarm:** neighbour or volunteer marks "seen safe" -> flag clears, logged.

## 7. Privacy requirements
- Opt-in with plain-language consent; delete and download my data.
- Health data stored only on the local hub and the resident's device.
- Volunteer sees nothing medical before accepting; access expires on resolve; every view logged.
- Break-glass needs a logged reason; without consent only non-medical location is released.
- Self-reported disclaimer on every medical view.

## 8. Success measures (simulated scenario, computed not hard-coded)
Detection rate of trapped households, false alarms and how many were cleared, median time from first missed check-in to flag, versus a manual phone-call baseline. Always labelled simulated.

## 9. Risks and mitigations
| Risk | Mitigation |
|---|---|
| False alarms | Risk score, clusters matter more than single misses, human approval, seen safe |
| Sensitive data | Consent, local-only, tiered access, logs, deletion |
| Adoption before a disaster | Peacetime daily elder check-ins, neighbour proxy |
| Weak connectivity | Offline-first CRDT sync, SMS and QR fallbacks |
| Dead phone vs no response | Low-battery flag lowers urgency weight but still surfaces |

## 10. Demo (3 minutes)
Problem -> go offline -> normal check-ins -> flood, disaster mode -> about 6 neighbours silent, cluster flagged -> "Why this score?" -> approve -> volunteer accepts, briefing unlocks -> false alarm cleared -> simulated results -> tagline.
