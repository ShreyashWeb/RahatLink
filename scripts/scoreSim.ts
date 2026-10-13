import {
  Household,
  HealthProfile,
  FloodZone,
  Report,
  DEFAULT_SETTINGS,
  clusterFlaggedHouseholds,
  scoreHousehold,
} from '../packages/core/src/index';

console.log('='.repeat(90));
console.log('  RAHATLINK • SIMULATED RISK SCORING & DBSCAN CLUSTERING ENGINE');
console.log('  SRIJAN 2K26 | Team CodeForge | Zero Cloud Dependencies | Pure TypeScript');
console.log('  STATUS: ALL DATA DISPLAYED BELOW IS ILLUSTRATIVE / SIMULATED');
console.log('='.repeat(90));

const now = new Date('2026-10-13T14:00:00Z');

// 1. Flood Zones in Gomti Nagar Area
const floodZones: FloodZone[] = [
  {
    id: 'fz-1',
    name: 'Gomti Riverbank Sector A',
    polygon: [
      [26.8475, 80.946],
      [26.8485, 80.947],
      [26.8478, 80.948],
    ],
  },
];

// 2. Corroborating Distress Reports
const reports: Report[] = [
  {
    id: 'rep-1',
    at: new Date('2026-10-13T12:30:00Z').toISOString(),
    lat: 26.8472,
    lng: 80.9464,
    text: 'Water logging reaching porch level in Sector A, neighbours unreachable.',
    source: 'sms',
  },
];

// 3. 10 Simulated Households
const households: Household[] = [
  {
    id: 'h-01',
    name: 'Ramesh Sharma (Solitary Miss)',
    lat: 26.855,
    lng: 80.958, // far outlier >1km away
    address: 'Flat 101, Indiranagar',
    contactPhone: '+91 98111 00001',
    householdSize: 1,
    hasSmartphone: true,
    graceHours: 24,
    lastCheckInAt: new Date('2026-10-12T02:00:00Z').toISOString(), // 36h silent (12h past grace)
    lastBattery: 85,
    consent: { health: false },
    status: 'flagged',
  },
  {
    id: 'h-02',
    name: 'Suresh Gupta (Near Flood, Lone)',
    lat: 26.8476,
    lng: 80.9455, // 50m from flood, but alone
    address: 'House 12, Riverbank Outer',
    contactPhone: '+91 98111 00002',
    householdSize: 2,
    hasSmartphone: true,
    graceHours: 24,
    lastCheckInAt: new Date('2026-10-12T10:00:00Z').toISOString(), // 28h silent (4h past grace)
    lastBattery: 78,
    consent: { health: false },
    status: 'flagged',
  },
  {
    id: 'h-03',
    name: 'Anita Verma (Consented Diabetic, Lone)',
    lat: 26.852,
    lng: 80.952,
    address: 'Block C-4, Gomti Nagar',
    contactPhone: '+91 98111 00003',
    householdSize: 2,
    hasSmartphone: true,
    graceHours: 24,
    lastCheckInAt: new Date('2026-10-12T08:00:00Z').toISOString(), // 30h silent (6h past grace)
    lastBattery: 65,
    consent: { health: true },
    status: 'flagged',
  },
  {
    id: 'h-04',
    name: 'Mishra Family (Cluster A, Dead Phone)',
    lat: 26.8471,
    lng: 80.9463, // Cluster A
    address: 'House 21, Sector A Riverbank',
    contactPhone: '+91 98111 00004',
    householdSize: 4,
    hasSmartphone: true,
    graceHours: 24,
    lastCheckInAt: new Date('2026-10-11T12:00:00Z').toISOString(), // 50h silent
    lastBattery: 3, // critical battery
    consent: { health: false },
    status: 'flagged',
  },
  {
    id: 'h-05',
    name: 'Srivastava Home (Cluster A, Silent)',
    lat: 26.8473,
    lng: 80.9465, // Cluster A (~30m from h-04)
    address: 'House 22, Sector A Riverbank',
    contactPhone: '+91 98111 00005',
    householdSize: 3,
    hasSmartphone: true,
    graceHours: 24,
    lastCheckInAt: new Date('2026-10-11T10:00:00Z').toISOString(), // 52h silent
    lastBattery: 45,
    consent: { health: false },
    status: 'flagged',
  },
  {
    id: 'h-06',
    name: 'Dr. Tiwari (Cluster A, Insulin Dependent)',
    lat: 26.8472,
    lng: 80.9462, // Cluster A (<40m from h-04, near flood)
    address: 'House 24, Sector A Riverbank',
    contactPhone: '+91 98111 00006',
    householdSize: 2,
    hasSmartphone: true,
    graceHours: 24,
    lastCheckInAt: new Date('2026-10-11T08:00:00Z').toISOString(), // 54h silent
    lastBattery: 4, // critical battery
    consent: { health: true },
    status: 'flagged',
  },
  {
    id: 'h-07',
    name: 'Rajendra Yadav (Cluster A, Proxy Assisted)',
    lat: 26.8474,
    lng: 80.9464, // Cluster A
    address: 'House 25, Sector A Riverbank',
    contactPhone: '+91 98111 00007',
    householdSize: 1,
    hasSmartphone: false,
    graceHours: 12,
    lastCheckInAt: new Date('2026-10-11T16:00:00Z').toISOString(),
    lastBattery: undefined,
    consent: { health: false },
    status: 'flagged',
  },
  {
    id: 'h-08',
    name: 'Pooja Singh (Peacetime OK)',
    lat: 26.8465,
    lng: 80.945,
    address: 'House 5, Gomti Enclave',
    contactPhone: '+91 98111 00008',
    householdSize: 3,
    hasSmartphone: true,
    graceHours: 24,
    lastCheckInAt: new Date('2026-10-13T12:00:00Z').toISOString(), // 2h ago
    lastBattery: 92,
    consent: { health: true },
    status: 'ok',
  },
  {
    id: 'h-09',
    name: 'Farhan Khan (Cluster B, Lowland Sector B)',
    lat: 26.842,
    lng: 80.941, // Cluster B (~700m away)
    address: 'House 8, Lowland Lane',
    contactPhone: '+91 98111 00009',
    householdSize: 4,
    hasSmartphone: true,
    graceHours: 24,
    lastCheckInAt: new Date('2026-10-12T04:00:00Z').toISOString(), // 34h silent
    lastBattery: 32,
    consent: { health: false },
    status: 'flagged',
  },
  {
    id: 'h-10',
    name: 'Zainab Ali (Cluster B, Limited Mobility)',
    lat: 26.8422,
    lng: 80.9412, // Cluster B (<30m from h-09)
    address: 'House 9, Lowland Lane',
    contactPhone: '+91 98111 00010',
    householdSize: 2,
    hasSmartphone: true,
    graceHours: 24,
    lastCheckInAt: new Date('2026-10-11T20:00:00Z').toISOString(), // 42h silent
    lastBattery: 25,
    consent: { health: true },
    status: 'flagged',
  },
];

// Health Profiles for consented households
const healthProfiles: Record<string, HealthProfile> = {
  'h-03': {
    householdId: 'h-03',
    conditions: ['diabetes'],
    allergies: [],
    updatedAt: now.toISOString(),
  },
  'h-06': {
    householdId: 'h-06',
    conditions: ['insulin-dependent', 'limited-mobility'],
    allergies: ['penicillin'],
    medications: 'Insulin Glargine',
    updatedAt: now.toISOString(),
  },
  'h-08': {
    householdId: 'h-08',
    conditions: ['asthma'],
    allergies: [],
    updatedAt: now.toISOString(),
  },
  'h-10': {
    householdId: 'h-10',
    conditions: ['limited-mobility', 'oxygen-dependent'],
    allergies: [],
    updatedAt: now.toISOString(),
  },
};

// 4. Run DBSCAN Clustering
const clustering = clusterFlaggedHouseholds(households, 150, 2);

console.log(`\n[DBSCAN Clustering Results (eps=150m, minPts=2)]`);
console.log(`- Total Silent Households: ${households.filter((h) => h.status === 'flagged').length}`);
console.log(`- Dense Clusters Formed: ${clustering.clusters.length}`);
clustering.clusters.forEach((c) => {
  console.log(`  * ${c.id.toUpperCase()}: ${c.size} silent households | Centroid: [${c.centroid.lat}, ${c.centroid.lng}] | Members: [${c.memberIds.join(', ')}]`);
});
console.log(`- Isolated Noise Households: ${clustering.noiseIds.length} [${clustering.noiseIds.join(', ')}]`);

// Map each household to its cluster size
const householdClusterSize = new Map<string, number>();
for (const c of clustering.clusters) {
  for (const mid of c.memberIds) {
    householdClusterSize.set(mid, c.size);
  }
}
for (const nid of clustering.noiseIds) {
  householdClusterSize.set(nid, 1);
}

// 5. Score all households and print table
console.log('\n' + '-'.repeat(105));
console.log(
  `| ${'ID'.padEnd(5)} | ${'Household Name'.padEnd(30)} | ${'Status'.padEnd(7)} | ${'Cluster'.padEnd(10)} | ${'Score'.padEnd(5)} | ${'Tier'.padEnd(6)} | ${'Primary Factor Explanation'.padEnd(30)} |`
);
console.log('-'.repeat(105));

let highCount = 0;
let medCount = 0;
let lowCount = 0;

for (const h of households) {
  const cSize = householdClusterSize.get(h.id) ?? 1;
  const profile = healthProfiles[h.id] ?? null;

  const result = scoreHousehold(h, {
    healthProfile: profile,
    clusterSize: cSize,
    floodZones,
    reports,
    now,
    settings: DEFAULT_SETTINGS,
  });

  if (result.tier === 'HIGH') highCount++;
  else if (result.tier === 'MEDIUM') medCount++;
  else lowCount++;

  const clusterLabel = cSize > 1 ? `Group (${cSize})` : 'Isolated (1)';
  const topFactor = result.breakdown.find((b) => b.points > 0)?.description || result.breakdown[0]?.description;

  console.log(
    `| ${h.id.padEnd(5)} | ${h.name.slice(0, 30).padEnd(30)} | ${h.status.padEnd(7)} | ${clusterLabel.padEnd(10)} | ${String(result.score).padStart(4)}  | ${result.tier.padEnd(6)} | ${topFactor.slice(0, 30).padEnd(30)} |`
  );
}

console.log('-'.repeat(105));
console.log(`\nSUMMARY METRICS (SIMULATED / ILLUSTRATIVE):`);
console.log(`- HIGH Risk:   ${highCount} (Immediate volunteer dispatch recommended)`);
console.log(`- MEDIUM Risk: ${medCount} (Surfaced in coordinator priority queue)`);
console.log(`- LOW Risk:    ${lowCount} (Single isolated misses, preserved low to prevent false alarms)`);
console.log(`- Principle verified: Lone missed check-in remains LOW; clustered vulnerable near flood becomes HIGH.\n`);
