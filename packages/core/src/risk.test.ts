import { describe, it, expect } from 'vitest';
import { scoreHousehold, distanceToPolygon } from './risk';
import {
  Household,
  HealthProfile,
  FloodZone,
  DEFAULT_SETTINGS,
  Settings,
} from './index';

describe('Risk Scoring Engine (packages/core/src/risk.ts)', () => {
  const baseTime = new Date('2026-10-13T12:00:00Z');

  const createHousehold = (overrides: Partial<Household> = {}): Household => ({
    id: 'h-100',
    name: 'Standard Resident',
    lat: 26.8467,
    lng: 80.9462,
    address: '10 Gomti Marg',
    contactPhone: '+91 98765 00000',
    householdSize: 2,
    hasSmartphone: true,
    graceHours: 24,
    lastCheckInAt: new Date(baseTime.getTime() - 36 * 3600 * 1000).toISOString(), // missed by 12h past 24h
    lastBattery: 85,
    consent: { health: true },
    status: 'flagged',
    ...overrides,
  });

  const floodZones: FloodZone[] = [
    {
      id: 'fz-1',
      name: 'Gomti Riverbank Sector A',
      polygon: [
        [26.8474, 80.9462], // ~78 metres north of 26.8467
        [26.848, 80.947],
        [26.8475, 80.948],
      ],
    },
  ];

  it('calculates point-to-polygon distance accurately', () => {
    const point = { lat: 26.8467, lng: 80.9462 };
    const dist = distanceToPolygon(point, floodZones[0].polygon);
    // 26.8474 vs 26.8467 is ~78m
    expect(dist).toBeGreaterThan(70);
    expect(dist).toBeLessThan(85);
  });

  it('1. Isolated missed check-in with no other factors must come out LOW (< 40)', () => {
    // Lone miss, no cluster (clusterSize = 1), no medical conditions, no flood zone, good battery
    const h = createHousehold({
      lastCheckInAt: new Date(baseTime.getTime() - 36 * 3600 * 1000).toISOString(),
      lastBattery: 90,
      consent: { health: false },
    });

    const result = scoreHousehold(h, {
      clusterSize: 1,
      floodZones: [],
      reports: [],
      now: baseTime,
      settings: DEFAULT_SETTINGS,
    });

    // Only silence points (~10-25), all other factors 0
    expect(result.score).toBeLessThan(40);
    expect(result.tier).toBe('LOW');
    expect(result.breakdown.find((b) => b.factor === 'clusterSize')?.points).toBe(0);
    expect(result.breakdown.find((b) => b.factor === 'medicalVulnerability')?.points).toBe(0);
    expect(result.breakdown.find((b) => b.factor === 'floodZoneDistance')?.points).toBe(0);
  });

  it('2. Clustered + insulin-dependent + 80m from flood zone + battery 4% becomes HIGH (>= 70)', () => {
    const h = createHousehold({
      lastCheckInAt: new Date(baseTime.getTime() - 60 * 3600 * 1000).toISOString(), // 36h past grace
      lastBattery: 4, // critical battery
      consent: { health: true },
    });

    const healthProfile: HealthProfile = {
      householdId: h.id,
      conditions: ['insulin-dependent', 'limited-mobility'],
      allergies: ['penicillin'],
      updatedAt: baseTime.toISOString(),
    };

    const result = scoreHousehold(h, {
      healthProfile,
      clusterSize: 4, // clustered with 3 neighbours
      floodZones, // 78m away
      reports: [],
      now: baseTime,
      settings: DEFAULT_SETTINGS,
    });

    // silence: 25, cluster: 20, medical: 25, flood: 15, battery: 5 = 90
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.tier).toBe('HIGH');

    // Confirm human-readable sentences
    const breakdownTexts = result.breakdown.map((b) => b.description);
    expect(breakdownTexts.some((t) => t.includes('insulin-dependent'))).toBe(true);
    expect(breakdownTexts.some((t) => t.includes('nearby neighbours also silent'))).toBe(true);
    expect(breakdownTexts.some((t) => t.includes('Critical battery 4%'))).toBe(true);
  });

  it('3. Privacy enforcement: consent.health=false hides and zeroes medical points', () => {
    const hNoConsent = createHousehold({
      consent: { health: false }, // consent NOT granted
    });

    const healthProfile: HealthProfile = {
      householdId: hNoConsent.id,
      conditions: ['insulin-dependent'],
      allergies: [],
      updatedAt: baseTime.toISOString(),
    };

    const result = scoreHousehold(hNoConsent, {
      healthProfile,
      clusterSize: 1,
      settings: DEFAULT_SETTINGS,
    });

    const medicalItem = result.breakdown.find((b) => b.factor === 'medicalVulnerability');
    expect(medicalItem?.points).toBe(0);
    expect(medicalItem?.description).toContain('Health consent not granted');
  });

  it('4. Tunable weights change the risk score tier dynamically', () => {
    const h = createHousehold({
      lastCheckInAt: new Date(baseTime.getTime() - 60 * 3600 * 1000).toISOString(),
    });

    // Default weights: silence is 25 max -> alone it is LOW (<40)
    const defaultResult = scoreHousehold(h, {
      clusterSize: 1,
      settings: DEFAULT_SETTINGS,
      now: baseTime,
    });
    expect(defaultResult.tier).toBe('LOW');

    // Custom coordinator weights: increase silence weight to 50
    const customSettings: Settings = {
      ...DEFAULT_SETTINGS,
      weights: {
        ...DEFAULT_SETTINGS.weights,
        silenceBeyondGrace: 50,
      },
    };

    const tunedResult = scoreHousehold(h, {
      clusterSize: 1,
      settings: customSettings,
      now: baseTime,
    });

    // Score is now 50 -> transitions to MEDIUM
    expect(tunedResult.score).toBe(50);
    expect(tunedResult.tier).toBe('MEDIUM');
  });
});
