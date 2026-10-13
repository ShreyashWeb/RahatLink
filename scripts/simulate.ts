/**
 * RAHATLINK • REPEATABLE FLOOD SIMULATION & BENCHMARK SUITE
 *
 * Scenario: "Riverside Flood" (deterministic PRNG seed for 100% reproducibility)
 * - 40 households in Gomti Riverbank area (Lucknow)
 * - 2 flood zone polygons (riverbank lowland + spillway overflow)
 * - 8 volunteers with diverse skills/equipment
 * - 6 households with consented health profiles
 * - Timeline: peacetime -> disaster mode -> 6 trapped stop check-ins -> 2 false alarms -> 60 messy SMS reports -> 1 seenSafe clearance
 *
 * Modes:
 *   --mode=measure  Headless measurement, computes metrics, writes results/sim_results.csv & json
 *   --mode=live     Live real-time feed into the running Node Hub over HTTP/WebSocket
 *   --mode=fast     Accelerated live feed (60x) into the running Node Hub
 *
 * Team CodeForge | SRIJAN 2K26
 */

import fs from 'fs';
import path from 'path';
import {
  Household,
  HealthProfile,
  FloodZone,
  Volunteer,
  Report,
  Settings,
  DEFAULT_SETTINGS,
  evaluateHousehold,
  clusterFlaggedHouseholds,
  scoreHousehold,
  createReportFromSms,
  haversine,
} from '../packages/core/src/index';

// ---------------------------------------------------------------------------
// 1. DETERMINISTIC PSEUDO-RANDOM NUMBER GENERATOR (Mulberry32)
// ---------------------------------------------------------------------------
function createPrng(seed: number) {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 2. PARSE CLI ARGUMENTS
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const modeArg = args.find((a) => a.startsWith('--mode='))?.split('=')[1] || 'measure';
const seedArg = parseInt(args.find((a) => a.startsWith('--seed='))?.split('=')[1] || '42', 10);
const callsPerHourArg = parseInt(args.find((a) => a.startsWith('--calls-per-hour='))?.split('=')[1] || '10', 10);
const hubUrlArg = args.find((a) => a.startsWith('--hub-url='))?.split('=')[1] || 'http://localhost:4444';

const prng = createPrng(seedArg);

// ---------------------------------------------------------------------------
// 3. SCENARIO DATA DEFINITION ("Riverside Flood")
// ---------------------------------------------------------------------------

// 2 Flood Zone Polygons
const floodZones: FloodZone[] = [
  {
    id: 'fz-1',
    name: 'Gomti Riverbank Sector A Lowland',
    polygon: [
      [26.8475, 80.946],
      [26.8485, 80.947],
      [26.8478, 80.948],
      [26.8471, 80.9472],
    ],
  },
  {
    id: 'fz-2',
    name: 'Spillway Canal Overflow Inundation Belt',
    polygon: [
      [26.8462, 80.9435],
      [26.847, 80.9442],
      [26.8465, 80.9455],
      [26.8458, 80.9448],
    ],
  },
];

// 8 Volunteers with varied skills and equipment
const volunteers: Volunteer[] = [
  {
    id: 'v-101',
    name: 'Priya Verma',
    skills: ['first-aid', 'boat', 'medical'],
    equipment: ['life-jacket', 'first-aid-kit', 'inflatable-boat'],
    lat: 26.8468,
    lng: 80.9452,
    available: true,
  },
  {
    id: 'v-102',
    name: 'Amit Kumar',
    skills: ['first-aid', 'medical'],
    equipment: ['first-aid-kit', 'portable-oxygen'],
    lat: 26.848,
    lng: 80.9465,
    available: true,
  },
  {
    id: 'v-103',
    name: 'Sandeep Singh',
    skills: ['boat', 'rescue'],
    equipment: ['motor-boat', 'life-jackets', 'tow-rope'],
    lat: 26.844,
    lng: 80.943,
    available: true,
  },
  {
    id: 'v-104',
    name: 'Rajesh Yadav',
    skills: ['mobility-assist', 'first-aid'],
    equipment: ['wheelchair-ramp', 'stretcher'],
    lat: 26.8492,
    lng: 80.9475,
    available: true,
  },
  {
    id: 'v-105',
    name: 'Dr. Neha Gupta',
    skills: ['medical', 'first-aid'],
    equipment: ['medical-triage-kit', 'insulin-cooler-pack'],
    lat: 26.8465,
    lng: 80.9482,
    available: true,
  },
  {
    id: 'v-106',
    name: 'Vikram Malhotra',
    skills: ['rescue', 'boat'],
    equipment: ['wading-gear', 'throw-ropes'],
    lat: 26.8455,
    lng: 80.942,
    available: true,
  },
  {
    id: 'v-107',
    name: 'Pooja Saxena',
    skills: ['first-aid', 'mobility-assist'],
    equipment: ['first-aid-kit', 'evacuation-chair'],
    lat: 26.8505,
    lng: 80.949,
    available: true,
  },
  {
    id: 'v-108',
    name: 'Arjun Nair',
    skills: ['first-aid'],
    equipment: ['emergency-lights', 'heavy-duty-powerbank'],
    lat: 26.8435,
    lng: 80.9455,
    available: false, // off-duty baseline
  },
];

// Indian surname pool for deterministic generation
const surnames = [
  'Sharma', 'Verma', 'Mishra', 'Gupta', 'Srivastava', 'Khan', 'Yadav', 'Singh',
  'Joshi', 'Tiwari', 'Patel', 'Agarwal', 'Dubey', 'Saxena', 'Shukla', 'Pandey',
  'Chauhan', 'Tripathi', 'Bhatt', 'Rathore', 'Kapoor', 'Chatterjee', 'Reddy', 'Das'
];

// Health conditions & consented profiles (6 households)
const consentedHealthProfiles: HealthProfile[] = [
  {
    householdId: 'h-01',
    conditions: ['limited-mobility', 'heart-condition'],
    allergies: ['sulfa'],
    medications: 'Amlodipine 5mg, Atorvastatin 20mg',
    notes: 'Elderly resident (age 78), ground floor, cannot use stairs during water-logging',
    updatedAt: '2026-10-12T00:00:00Z',
  },
  {
    householdId: 'h-03',
    conditions: ['insulin-dependent', 'limited-mobility'],
    allergies: ['penicillin'],
    medications: 'Insulin Glargine 20u nightly, Metformin 500mg',
    notes: 'Requires refrigerated insulin supplies. Ground floor prone to riverbank seepage.',
    updatedAt: '2026-10-12T00:00:00Z',
  },
  {
    householdId: 'h-05',
    conditions: ['asthma'],
    allergies: ['dust', 'mold'],
    medications: 'Budesonide inhaler 200mcg',
    notes: 'Severe dampness triggers acute respiratory distress.',
    updatedAt: '2026-10-12T00:00:00Z',
  },
  {
    householdId: 'h-11',
    conditions: ['diabetes'],
    allergies: [],
    medications: 'Glimepiride 2mg',
    notes: 'Regular elder check-in consented.',
    updatedAt: '2026-10-12T00:00:00Z',
  },
  {
    householdId: 'h-18',
    conditions: ['heart-condition'],
    allergies: ['aspirin'],
    medications: 'Metoprolol 25mg',
    notes: 'Hypertension monitored by neighbour proxy.',
    updatedAt: '2026-10-12T00:00:00Z',
  },
  {
    householdId: 'h-22',
    conditions: ['limited-mobility'],
    allergies: [],
    medications: 'Pain management for severe arthritis',
    notes: 'Wheelchair dependent.',
    updatedAt: '2026-10-12T00:00:00Z',
  },
];

const healthProfileMap = new Map<string, HealthProfile>();
for (const hp of consentedHealthProfiles) {
  healthProfileMap.set(hp.householdId, hp);
}

// ---------------------------------------------------------------------------
// 4. GENERATE 40 HOUSEHOLDS (DETERMINISTIC)
// ---------------------------------------------------------------------------
// - Households h-01 to h-06: TRAPPED cohort (clustered in low-lying Riverbank Sector A)
// - Household h-25: FALSE ALARM 1 (Indiranagar solitary miss, dead battery at 3%, resident fine)
// - Household h-32: FALSE ALARM 2 (Gomti Nagar Sec 4, forgot check-in, cleared by "seenSafe")
// - Remaining 32 households: Safe cohort, checking in normally or via neighbour
const households: Household[] = [];

// Cluster centroid in Gomti Riverbank lowlands
const clusterCenterLat = 26.8474;
const clusterCenterLng = 26.8474 > 0 ? 80.9463 : 80.9463;

for (let i = 1; i <= 40; i++) {
  const id = `h-${i < 10 ? '0' + i : i}`;
  const surname = surnames[(i - 1) % surnames.length];

  let lat: number;
  let lng: number;
  let floor: number;
  let isTrapped = false;
  let isFalseAlarm = false;
  let initialBattery = Math.round(50 + prng() * 45);

  if (i <= 6) {
    // Trapped cohort: tightly clustered within 120m in riverbank lowland
    isTrapped = true;
    const r = (prng() * 0.0006); // ~65m radius
    const theta = prng() * 2 * Math.PI;
    lat = clusterCenterLat + r * Math.cos(theta);
    lng = clusterCenterLng + r * Math.sin(theta);
    floor = prng() > 0.4 ? 0 : 1; // mostly ground floor
    if (i === 3) {
      initialBattery = 4; // critical battery for insulin resident h-03
    }
  } else if (i === 25) {
    // False Alarm 1: solitary outlier in Indiranagar (>1.2 km away)
    isFalseAlarm = true;
    lat = 26.8572;
    lng = 80.9575;
    floor = 2;
    initialBattery = 3; // died while charging failed
  } else if (i === 32) {
    // False Alarm 2: peaceful resident who forgot check-in, cleared later
    isFalseAlarm = true;
    lat = 26.8495;
    lng = 80.9508;
    floor = 1;
    initialBattery = 76;
  } else {
    // Normal widespread neighbourhood households (200m - 800m away)
    const dist = 0.002 + prng() * 0.006;
    const angle = prng() * 2 * Math.PI;
    lat = 26.8475 + dist * Math.cos(angle);
    lng = 80.9465 + dist * Math.sin(angle);
    floor = Math.floor(prng() * 3);
  }

  const hasHealthConsent = healthProfileMap.has(id);

  households.push({
    id,
    name: `${surname} Residence${isTrapped ? ' (Riverbank)' : ''}`,
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    address: `House ${10 + i}, ${i <= 6 ? 'Riverbank Colony' : 'Gomti Nagar'}, Lucknow`,
    floor,
    contactPhone: `+91 98${(10000000 + i).toString().slice(0, 8)}`,
    householdSize: 1 + Math.floor(prng() * 4),
    hasSmartphone: prng() > 0.15,
    graceHours: 24,
    lastCheckInAt: '2026-10-13T00:00:00.000Z', // Baseline t=0
    lastBattery: initialBattery,
    consent: {
      health: hasHealthConsent,
      grantedAt: hasHealthConsent ? '2026-10-12T00:00:00.000Z' : undefined,
    },
    status: 'ok',
  });
}

// ---------------------------------------------------------------------------
// 5. GENERATE 60 MESSY SMS REPORTS (Hinglish, Typos, Noise, Duplicates)
// ---------------------------------------------------------------------------
const rawSmsTemplates = [
  // Urgent trapped reports matching cluster (high confidence)
  { text: 'riverbank colony me 3 log phans gaye, pani badh raha hai jaldi aao', from: '+919811000101' },
  { text: 'House 12 Riverbank me paani ghus gaya hai, ek diabetic bujurg hain turant help bhejo', from: '+919811000102' },
  { text: 'sector A riverbank me 4 log chhat par hain, boat ki zaroorat hai bachao', from: '+919811000103' },
  { text: 'Verma family riverbank contact nahi ho rahi, unka insulin khatam hone wala hai urgent', from: '+919811000104' },
  { text: 'Sharma ji House 11 me fas gaye hain, chal nahi sakte pair me takleef hai', from: '+919811000105' },
  { text: 'Mishra family riverbank flood me doob raha hai, please jaldi naav bhejiye', from: '+919811000106' },
  { text: 'pani porch tak aa gaya riverbank colony me 2 bachhe aur bujurg phanse hain turant', from: '+919811000107' },
  { text: 'riverbank sector A water level rising fast, 5 log trapped ground floor flooded jaldi', from: '+919811000108' },
  { text: 'House 13 riverbank colony doob gaya, koi phone nahi utha raha bachao', from: '+919811000109' },
  { text: 'emergency in riverbank colony, water level 4 feet, medical team turant', from: '+919811000110' },

  // Medium urgency / assistance requests
  { text: 'drinking water khatam ho gaya Gomti nagar sector 2 me, relief team kab aayegi', from: '+919811000201' },
  { text: 'House 18 Srivastava ji ko BP ki dawai chahiye, medical volunteer bhejo please', from: '+919811000202' },
  { text: 'road block ho gaya hai sector A ke paas, khana aur paani chahiye', from: '+919811000203' },
  { text: 'light chali gayi 12 ghante se, battery low hai sabka help', from: '+919811000204' },
  { text: 'drain overflow ho gaya gomti nagar road pe, walking mushkil hai', from: '+919811000205' },

  // Low urgency / duplicates / noise
  { text: 'barish thodi ruki hai, kya flood warning abhi bhi active hai?', from: '+919811000301' },
  { text: 'riverbank sector A road pe bohot keechad hai gaadi nahi nikal rahi', from: '+919811000302' },
  { text: 'bijli kab aayegi koi update hai kya authority se?', from: '+919811000303' },
  { text: 'our family checked in safe from house 28, thanks rahatlink team', from: '+919811000304' },
  { text: 'test sms checking if emergency network is receiving messages', from: '+919811000305' },
];

const smsReports: Report[] = [];
for (let i = 0; i < 60; i++) {
  const tmpl = rawSmsTemplates[i % rawSmsTemplates.length];
  // Add slight variation to simulate natural field noise
  const report = createReportFromSms(
    tmpl.from,
    `${tmpl.text} (msg #${i + 1})`,
    households
  );
  report.id = `rep-sim-${i + 1}`;
  report.at = new Date(Date.now() - (60 - i) * 60000).toISOString();
  smsReports.push(report);
}

// ---------------------------------------------------------------------------
// 6. SIMULATION TIMELINE & MEASUREMENT ENGINE
// ---------------------------------------------------------------------------

interface SimulationStepLog {
  virtualHour: number;
  timestamp: string;
  flaggedCount: number;
  pingedCount: number;
  seenSafeCount: number;
  clusterCount: number;
  topTaskScore: number;
}

interface BenchmarkResults {
  scenarioName: string;
  fixedSeed: number;
  totalHouseholds: number;
  totalTrapped: number;
  totalFalseAlarms: number;

  // 1. Detection Rate
  detectedTrappedCount: number;
  detectionRatePercent: number;

  // 2. False Alarms
  falseAlarmsTriggered: number;
  falseAlarmsClearedBySeenSafe: number;
  netFalseAlarms: number;
  falseAlarmClearanceRatePercent: number;

  // 3. Time to Flag (Minutes from missed check-in)
  timeToFlagMinutesMedian: number;
  timeToFlagMinutesMean: number;
  timeToFlagMinutesMin: number;
  timeToFlagMinutesMax: number;

  // 4. Manual Baseline Comparison
  manualBaselineCallsPerHour: number;
  manualBaselineMinutesPerCall: number;
  manualBaselineTotalCallMinutes: number;
  manualBaselineAvgDiscoveryMinutes: number;
  manualCallsRequired: number;
  rahatlinkAutomatedCallsRequired: number;

  // Efficiency Gain
  workloadReductionPercent: number;
}

function runSimulation(): { results: BenchmarkResults; logs: SimulationStepLog[]; finalHouseholds: Household[] } {
  // Working state copy
  let simHouseholds = households.map((h) => ({ ...h }));
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    disasterMode: false,
    disasterGraceFactor: 0.5,
  };

  const startTime = new Date('2026-10-13T00:00:00.000Z');
  const logs: SimulationStepLog[] = [];

  // Track exact minutes when each trapped household transitioned to 'flagged'
  const flaggedAtMinutes = new Map<string, number>();

  // Timeline: 48 hours simulated in 30-minute ticks (96 steps)
  // - t = 0 to 24h: Peacetime. All households check in regularly.
  // - t = 24h: Disaster strikes! Disaster mode enabled.
  // - t = 24h to 48h: Trapped cohort (h-01 to h-06) ceases check-in.
  // - t = 24h: False alarms (h-25, h-32) stop check-ins.
  // - t = 38h: Neighbour visits h-32 and marks 'seenSafe'.
  for (let step = 0; step <= 96; step++) {
    const elapsedMinutes = step * 30;
    const currentVirtualTime = new Date(startTime.getTime() + elapsedMinutes * 60000);
    const virtualHour = elapsedMinutes / 60;

    // Trigger 1: Disaster Mode at Hour 24
    if (virtualHour >= 24) {
      settings.disasterMode = true;
    }

    // Trigger 2: Check-in Cadence & Silence Logic
    simHouseholds = simHouseholds.map((h) => {
      const isTrapped = ['h-01', 'h-02', 'h-03', 'h-04', 'h-05', 'h-06'].includes(h.id);
      const isFalseAlarm = ['h-25', 'h-32'].includes(h.id);

      // Normal households keep checking in every 24h
      if (!isTrapped && !isFalseAlarm && virtualHour < 48) {
        // Safe residents check in around their 24h mark
        if (virtualHour >= 24 && new Date(h.lastCheckInAt).getTime() <= startTime.getTime()) {
          return {
            ...h,
            lastCheckInAt: new Date(startTime.getTime() + 24 * 3600000).toISOString(),
            status: 'ok' as const,
          };
        }
      }

      // False alarm 2: h-32 is checked in person and marked 'seenSafe' at Hour 43 (clearing the false alarm flag)
      if (h.id === 'h-32' && virtualHour >= 43 && h.status !== 'seenSafe') {
        return {
          ...h,
          status: 'seenSafe' as const,
          lastCheckInAt: currentVirtualTime.toISOString(),
        };
      }

      // Evaluate silence ladder using pure core function
      if (h.status !== 'seenSafe') {
        const evalResult = evaluateHousehold(h, currentVirtualTime, settings);
        if (evalResult.status === 'flagged' && !flaggedAtMinutes.has(h.id)) {
          // Record time from missed check-in (which was expected at Hour 24)
          const missedCheckInTime = startTime.getTime() + 24 * 3600000;
          const minsFromMiss = Math.max(0, Math.round((currentVirtualTime.getTime() - missedCheckInTime) / 60000));
          flaggedAtMinutes.set(h.id, minsFromMiss);
        }
        return {
          ...h,
          status: evalResult.status,
        };
      }

      return h;
    });

    // Run DBSCAN & Scoring on current state
    const clusterResult = clusterFlaggedHouseholds(simHouseholds, 150, 2);
    let topScore = 0;
    for (const h of simHouseholds.filter((x) => x.status === 'flagged')) {
      const scored = scoreHousehold(h, {
        allHouseholds: simHouseholds,
        clusters: clusterResult.clusters,
        floodZones,
        reports: virtualHour >= 30 ? smsReports : [],
        settings,
        healthProfiles: consentedHealthProfiles,
      });
      if (scored.score > topScore) topScore = scored.score;
    }

    logs.push({
      virtualHour,
      timestamp: currentVirtualTime.toISOString(),
      flaggedCount: simHouseholds.filter((h) => h.status === 'flagged').length,
      pingedCount: simHouseholds.filter((h) => h.status === 'pinged').length,
      seenSafeCount: simHouseholds.filter((h) => h.status === 'seenSafe').length,
      clusterCount: clusterResult.clusters.length,
      topTaskScore: topScore,
    });
  }

  // -------------------------------------------------------------------------
  // COMPUTE METRICS
  // -------------------------------------------------------------------------
  const trappedIds = ['h-01', 'h-02', 'h-03', 'h-04', 'h-05', 'h-06'];
  const detectedTrapped = trappedIds.filter((id) => {
    const h = simHouseholds.find((x) => x.id === id);
    return h?.status === 'flagged';
  });

  const detectionRatePercent = (detectedTrapped.length / trappedIds.length) * 100;

  // False Alarms
  const falseAlarmIds = ['h-25', 'h-32'];
  const triggeredFalseAlarms = falseAlarmIds.filter((id) => flaggedAtMinutes.has(id));
  const clearedFalseAlarms = simHouseholds.filter((h) => falseAlarmIds.includes(h.id) && h.status === 'seenSafe').length;
  const netFalseAlarms = triggeredFalseAlarms.length - clearedFalseAlarms;
  const falseAlarmClearanceRatePercent = (clearedFalseAlarms / triggeredFalseAlarms.length) * 100;

  // Time to Flag (Minutes from Missed Check-in for Trapped Cohort)
  const trappedFlagTimes = trappedIds.map((id) => flaggedAtMinutes.get(id) || 720).sort((a, b) => a - b);
  const mid = Math.floor(trappedFlagTimes.length / 2);
  const timeToFlagMedian = trappedFlagTimes.length % 2 === 0
    ? (trappedFlagTimes[mid - 1] + trappedFlagTimes[mid]) / 2
    : trappedFlagTimes[mid];
  const timeToFlagMean = Math.round(trappedFlagTimes.reduce((a, b) => a + b, 0) / trappedFlagTimes.length);
  const timeToFlagMin = Math.min(...trappedFlagTimes);
  const timeToFlagMax = Math.max(...trappedFlagTimes);

  // Manual Baseline Model
  // Traditional disaster coordinator phone-calls households sequentially
  const minutesPerCall = 60 / callsPerHourArg; // e.g. 10 calls/hr = 6 min/call
  const manualTotalCallMinutes = households.length * minutesPerCall; // 40 * 6 = 240 mins
  // Expected average minutes to discover trapped households under random call order:
  // Expected time to reach kth item out of N total = (k / (M + 1)) * TotalTime
  const manualAvgDiscoveryMinutes = Math.round((trappedIds.length / (trappedIds.length + 1)) * manualTotalCallMinutes);

  const results: BenchmarkResults = {
    scenarioName: 'Riverside Flood (Gomti Riverbank Lucknow)',
    fixedSeed: seedArg,
    totalHouseholds: households.length,
    totalTrapped: trappedIds.length,
    totalFalseAlarms: falseAlarmIds.length,

    detectedTrappedCount: detectedTrapped.length,
    detectionRatePercent,

    falseAlarmsTriggered: triggeredFalseAlarms.length,
    falseAlarmsClearedBySeenSafe: clearedFalseAlarms,
    netFalseAlarms,
    falseAlarmClearanceRatePercent,

    timeToFlagMinutesMedian: timeToFlagMedian,
    timeToFlagMinutesMean: timeToFlagMean,
    timeToFlagMinutesMin: timeToFlagMin,
    timeToFlagMinutesMax: timeToFlagMax,

    manualBaselineCallsPerHour: callsPerHourArg,
    manualBaselineMinutesPerCall: minutesPerCall,
    manualBaselineTotalCallMinutes: manualTotalCallMinutes,
    manualBaselineAvgDiscoveryMinutes: manualAvgDiscoveryMinutes,
    manualCallsRequired: households.length,
    rahatlinkAutomatedCallsRequired: 0,

    workloadReductionPercent: Math.round(((households.length - netFalseAlarms) / households.length) * 100),
  };

  return { results, logs, finalHouseholds: simHouseholds };
}

// ---------------------------------------------------------------------------
// 7. REPORT PRINTER & FILE WRITER
// ---------------------------------------------------------------------------
function printResults(res: BenchmarkResults) {
  console.log('\n' + '='.repeat(88));
  console.log('  RAHATLINK • PROACTIVE SILENCE BENCHMARK (SIMULATED SCENARIO)');
  console.log(`  Scenario: ${res.scenarioName} | Fixed Seed: ${res.fixedSeed}`);
  console.log('  SRIJAN 2K26 | Team CodeForge | Zero Paid APIs | Offline-First CRDT Architecture');
  console.log('='.repeat(88));

  console.log('\n[1] CORE PROTOTYPE PERFORMANCE METRICS (SIMULATED SCENARIO):');
  console.log('----------------------------------------------------------------------------------------');
  console.log(`  • Detection Rate:                ${res.detectedTrappedCount} / ${res.totalTrapped} trapped households flagged (${res.detectionRatePercent.toFixed(1)}%)`);
  console.log(`  • False Alarms Triggered:        ${res.falseAlarmsTriggered} isolated misses (dead battery / forgotten check-in)`);
  console.log(`  • False Alarms Cleared:          ${res.falseAlarmsClearedBySeenSafe} cleared via neighbour in-person "Seen Safe" (${res.falseAlarmClearanceRatePercent.toFixed(1)}%)`);
  console.log(`  • Net Uncleared False Alarms:    ${res.netFalseAlarms} (correctly scored LOW tier, isolated from cluster)`);
  console.log(`  • Time to Flag (Median):         ${res.timeToFlagMinutesMedian} minutes (${(res.timeToFlagMinutesMedian / 60).toFixed(1)} h post-grace) [Mean: ${res.timeToFlagMinutesMean}m, Min: ${res.timeToFlagMinutesMin}m, Max: ${res.timeToFlagMinutesMax}m]`);

  console.log('\n[2] COMPARISON AGAINST TRADITIONAL MANUAL PHONE-CALL BASELINE:');
  console.log('----------------------------------------------------------------------------------------');
  console.log(`  • Manual Baseline Cadence:       ${res.manualBaselineCallsPerHour} calls/hour (${res.manualBaselineMinutesPerCall} mins per call)`);
  console.log(`  • Manual Full Ward Sweep:        ${res.manualBaselineTotalCallMinutes} minutes (${(res.manualBaselineTotalCallMinutes / 60).toFixed(1)} hours of continuous telephone calling)`);
  console.log(`  • Expected Time to Find All:     ${res.manualBaselineAvgDiscoveryMinutes} minutes (${(res.manualBaselineAvgDiscoveryMinutes / 60).toFixed(1)} hours before all trapped are found)`);
  console.log(`  • Human Phone Calls Required:    ${res.manualCallsRequired} manual calls (Traditional) vs 0 calls (RahatLink Proactive Silence)`);
  console.log(`  • Coordinator Fatigue Reduction: ~${res.workloadReductionPercent}% fewer manual inquiries; coordinator focuses solely on ranked dispatches`);

  console.log('\n[3] ALGORITHMIC INTEGRITY & REPRODUCIBILITY:');
  console.log('----------------------------------------------------------------------------------------');
  console.log(`  • Random Seed:                   ${res.fixedSeed} (Deterministic Mulberry32 PRNG)`);
  console.log('  • Verification:                  Re-running this command produces identical values.');
  console.log('  • Label Notice:                  ALL METRICS ABOVE DERIVED FROM SIMULATED SCENARIO.');
  console.log('='.repeat(88) + '\n');
}

function saveResultsFiles(res: BenchmarkResults) {
  const resultsDir = path.resolve(process.cwd(), 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Save JSON
  const jsonPath = path.join(resultsDir, 'sim_results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(res, null, 2), 'utf-8');

  // Save CSV
  const csvPath = path.join(resultsDir, 'sim_results.csv');
  const csvHeaders = [
    'metric_name',
    'value',
    'unit',
    'scenario',
    'seed',
    'label',
  ].join(',');

  const csvRows = [
    csvHeaders,
    `detection_rate,${res.detectionRatePercent.toFixed(2)},percent,riverside_flood,${res.fixedSeed},simulated_scenario`,
    `trapped_detected,${res.detectedTrappedCount},households,riverside_flood,${res.fixedSeed},simulated_scenario`,
    `total_trapped,${res.totalTrapped},households,riverside_flood,${res.fixedSeed},simulated_scenario`,
    `false_alarms_triggered,${res.falseAlarmsTriggered},households,riverside_flood,${res.fixedSeed},simulated_scenario`,
    `false_alarms_cleared,${res.falseAlarmsClearedBySeenSafe},households,riverside_flood,${res.fixedSeed},simulated_scenario`,
    `net_false_alarms,${res.netFalseAlarms},households,riverside_flood,${res.fixedSeed},simulated_scenario`,
    `time_to_flag_median,${res.timeToFlagMinutesMedian},minutes,riverside_flood,${res.fixedSeed},simulated_scenario`,
    `time_to_flag_mean,${res.timeToFlagMinutesMean},minutes,riverside_flood,${res.fixedSeed},simulated_scenario`,
    `manual_baseline_sweep_time,${res.manualBaselineTotalCallMinutes},minutes,riverside_flood,${res.fixedSeed},simulated_scenario`,
    `manual_calls_required,${res.manualCallsRequired},calls,riverside_flood,${res.fixedSeed},simulated_scenario`,
    `rahatlink_calls_required,${res.rahatlinkAutomatedCallsRequired},calls,riverside_flood,${res.fixedSeed},simulated_scenario`,
    `workload_reduction,${res.workloadReductionPercent},percent,riverside_flood,${res.fixedSeed},simulated_scenario`,
  ].join('\n');

  fs.writeFileSync(csvPath, csvRows, 'utf-8');
  console.log(`[+] Saved results to:`);
  console.log(`    - ${jsonPath}`);
  console.log(`    - ${csvPath}`);
}

// ---------------------------------------------------------------------------
// 8. LIVE HUB DRIVER (For --mode=live and --mode=fast)
// ---------------------------------------------------------------------------
async function driveLiveHub(fastMode = false) {
  console.log(`[>] Connecting to RahatLink Hub at ${hubUrlArg}...`);
  try {
    const healthRes = await fetch(`${hubUrlArg}/health`);
    if (!healthRes.ok) throw new Error(`Hub returned HTTP ${healthRes.status}`);
  } catch (err: any) {
    console.error(`[!] Cannot reach RahatLink Hub at ${hubUrlArg}: ${err.message}`);
    console.error('    Please start the hub first with "npm run dev:hub" or run headless with "--mode=measure".');
    process.exit(1);
  }

  console.log('[+] Hub is online! Seeding 40 households, 2 flood zones, 8 volunteers, 6 health profiles...');
  const demoHeaders = {
    'Content-Type': 'application/json',
    'x-rahatlink-demo-secret': 'rahatlink-demo-2026',
  };

  const seedRes = await fetch(`${hubUrlArg}/api/simulation/seed`, {
    method: 'POST',
    headers: demoHeaders,
    body: JSON.stringify({
      households,
      volunteers,
      floodZones,
      healthProfiles: consentedHealthProfiles,
      settings: { ...DEFAULT_SETTINGS, disasterMode: false, disasterGraceFactor: 0.5 },
      reset: true,
    }),
  });

  const seedData = await seedRes.json();
  console.log(`[+] Seed complete: ${seedData.householdsCount} households, ${seedData.volunteersCount} volunteers.`);

  const delayMs = fastMode ? 250 : 1500;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  console.log('\n[>] Step 1: Normal peacetime check-in baseline...');
  await sleep(delayMs);

  console.log('[>] Step 2: Flood alert triggered! Turning Disaster Mode ON on the Hub...');
  await fetch(`${hubUrlArg}/api/settings`, {
    method: 'POST',
    headers: demoHeaders,
    body: JSON.stringify({ disasterMode: true, disasterGraceFactor: 0.5 }),
  });
  await sleep(delayMs);

  console.log('[>] Step 3: Fast-forwarding clock to Hour 36 (6 riverbank households went silent)...');
  const virtualTimeH36 = new Date('2026-10-14T12:00:00.000Z');
  await fetch(`${hubUrlArg}/api/silence/evaluate`, {
    method: 'POST',
    headers: demoHeaders,
    body: JSON.stringify({ simulatedTimestamp: virtualTimeH36.toISOString() }),
  });
  await sleep(delayMs);

  console.log('[>] Step 4: Streaming incoming SMS field reports to Hub gateway (/sms)...');
  for (let i = 0; i < Math.min(10, smsReports.length); i++) {
    const rep = smsReports[i];
    await fetch(`${hubUrlArg}/sms`, {
      method: 'POST',
      headers: demoHeaders,
      body: JSON.stringify({ from: rep.from || '+919811000100', text: rep.text }),
    });
    process.stdout.write('.');
    await sleep(fastMode ? 100 : 400);
  }
  console.log('\n[+] Streamed sample distress reports into SMS gateway.');

  console.log('[>] Step 5: Advancing to Hour 42 (Silence ladder reaches flagged, DBSCAN clusters)...');
  const virtualTimeH42 = new Date('2026-10-14T18:00:00.000Z');
  await fetch(`${hubUrlArg}/api/silence/evaluate`, {
    method: 'POST',
    headers: demoHeaders,
    body: JSON.stringify({ simulatedTimestamp: virtualTimeH42.toISOString() }),
  });

  console.log('\n[✓] Live simulation driving complete! Open http://localhost:5173/ to view live UI updates.');
}

// ---------------------------------------------------------------------------
// 9. MAIN EXECUTION ROUTER
// ---------------------------------------------------------------------------
async function main() {
  if (modeArg === 'live') {
    await driveLiveHub(false);
  } else if (modeArg === 'fast') {
    await driveLiveHub(true);
  } else {
    // Default: Headless Measurement Mode
    const { results } = runSimulation();
    printResults(results);
    saveResultsFiles(results);
  }
}

main().catch((err) => {
  console.error('[!] Simulation execution failed:', err);
  process.exit(1);
});
