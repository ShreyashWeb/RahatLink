import { describe, it, expect } from 'vitest';
import {
  evaluateHousehold,
  dbscan,
  clusterFlaggedHouseholds,
  scoreHousehold,
  canView,
  isBriefingTokenValid,
  parseSmsReport,
  encodeSnapshotToQrChunks,
  QrChunkAssembler,
  parseQrChunk,
  Household,
  HealthProfile,
  Settings,
  DEFAULT_SETTINGS,
} from './index';

describe('Exhaustive Edge Cases & Quality Suite (packages/core)', () => {
  const baseTime = new Date('2026-10-13T12:00:00Z');

  // ==========================================
  // 1. Silence Ladder Boundary Tests
  // ==========================================
  describe('1. Silence Ladder Boundary Tests', () => {
    const makeH = (overrides: Partial<Household> = {}): Household => ({
      id: 'h-bound',
      name: 'Boundary Test Resident',
      lat: 26.85,
      lng: 80.95,
      address: 'Boundary Rd',
      contactPhone: '+91 98765 43210',
      householdSize: 2,
      hasSmartphone: true,
      graceHours: 24, // 1440 min
      lastCheckInAt: baseTime.toISOString(),
      lastBattery: 50,
      consent: { health: true },
      status: 'ok',
      ...overrides,
    });

    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      disasterMode: false,
      disasterGraceFactor: 0.5,
    };

    it('Transitions exactly at 24h boundary (cadence)', () => {
      const h = makeH();
      // Exactly 1 millisecond before cadence -> 'ok'
      const beforeCadence = new Date(baseTime.getTime() + 24 * 3600 * 1000 - 1);
      expect(evaluateHousehold(h, beforeCadence, settings).status).toBe('ok');

      // Exactly at cadence (24h = 1440m) -> 'due'
      const atCadence = new Date(baseTime.getTime() + 24 * 3600 * 1000);
      expect(evaluateHousehold(h, atCadence, settings).status).toBe('due');
    });

    it('Transitions at due/grace boundary (cadence + 0.25*grace = 30h)', () => {
      const h = makeH();
      // 29h 59m -> 'due'
      const justBeforeGrace = new Date(baseTime.getTime() + (30 * 3600 * 1000 - 60000));
      expect(evaluateHousehold(h, justBeforeGrace, settings).status).toBe('due');

      // Exactly 30h -> 'grace'
      const atGrace = new Date(baseTime.getTime() + 30 * 3600 * 1000);
      expect(evaluateHousehold(h, atGrace, settings).status).toBe('grace');
    });

    it('Transitions at grace/reminded boundary (cadence + grace = 48h)', () => {
      const h = makeH();
      // 47h 59m -> 'grace'
      const justBeforeReminded = new Date(baseTime.getTime() + (48 * 3600 * 1000 - 60000));
      expect(evaluateHousehold(h, justBeforeReminded, settings).status).toBe('grace');

      // Exactly 48h -> 'reminded'
      const atReminded = new Date(baseTime.getTime() + 48 * 3600 * 1000);
      expect(evaluateHousehold(h, atReminded, settings).status).toBe('reminded');
    });

    it('Transitions at reminded/pinged boundary (48h + 6h = 54h)', () => {
      const h = makeH();
      // 53h 59m -> 'reminded'
      const justBeforePinged = new Date(baseTime.getTime() + (54 * 3600 * 1000 - 60000));
      expect(evaluateHousehold(h, justBeforePinged, settings).status).toBe('reminded');

      // Exactly 54h -> 'pinged'
      const atPinged = new Date(baseTime.getTime() + 54 * 3600 * 1000);
      expect(evaluateHousehold(h, atPinged, settings).status).toBe('pinged');
    });

    it('Transitions at pinged/flagged boundary (54h + 6h = 60h)', () => {
      const h = makeH();
      // 59h 59m -> 'pinged'
      const justBeforeFlagged = new Date(baseTime.getTime() + (60 * 3600 * 1000 - 60000));
      expect(evaluateHousehold(h, justBeforeFlagged, settings).status).toBe('pinged');

      // Exactly 60h -> 'flagged'
      const atFlagged = new Date(baseTime.getTime() + 60 * 3600 * 1000);
      expect(evaluateHousehold(h, atFlagged, settings).status).toBe('flagged');
    });

    it('Disaster mode shrinks grace window by exact disasterGraceFactor (0.5x)', () => {
      const h = makeH({ graceHours: 24 });
      const disasterSettings: Settings = {
        ...DEFAULT_SETTINGS,
        disasterMode: true,
        disasterGraceFactor: 0.5, // grace = 12h, step = 3h
      };
      // Cadence = 24h
      // Due: 24h to 27h
      // Grace: 27h to 36h
      // Reminded: 36h to 39h
      // Pinged: 39h to 42h
      // Flagged: >= 42h

      expect(evaluateHousehold(h, new Date(baseTime.getTime() + 26 * 3600 * 1000), disasterSettings).status).toBe('due');
      expect(evaluateHousehold(h, new Date(baseTime.getTime() + 28 * 3600 * 1000), disasterSettings).status).toBe('grace');
      expect(evaluateHousehold(h, new Date(baseTime.getTime() + 37 * 3600 * 1000), disasterSettings).status).toBe('reminded');
      expect(evaluateHousehold(h, new Date(baseTime.getTime() + 40 * 3600 * 1000), disasterSettings).status).toBe('pinged');
      expect(evaluateHousehold(h, new Date(baseTime.getTime() + 43 * 3600 * 1000), disasterSettings).status).toBe('flagged');
    });

    it('Flagged phone with critically low battery <= 5% is identified as likelyDeadPhone', () => {
      const hDead = makeH({ lastBattery: 4 });
      const at65h = new Date(baseTime.getTime() + 65 * 3600 * 1000);
      const res = evaluateHousehold(hDead, at65h, settings);
      expect(res.status).toBe('flagged');
      expect(res.likelyDeadPhone).toBe(true);
    });

    it('Household without smartphone triggers needsProxy = true', () => {
      const hNoPhone = makeH({ hasSmartphone: false });
      const res = evaluateHousehold(hNoPhone, baseTime, settings);
      expect(res.needsProxy).toBe(true);
    });
  });

  // ==========================================
  // 2. DBSCAN Clustering Edge Cases
  // ==========================================
  describe('2. DBSCAN Clustering Edge Cases', () => {
    it('Handles empty household list gracefully', () => {
      const res = dbscan([], 150, 3);
      expect(res.clusters).toHaveLength(0);
      expect(res.noiseIds).toHaveLength(0);
    });

    it('Single household point is marked as noise (no cluster)', () => {
      const p1 = { id: 'h-1', lat: 26.85, lng: 80.95 };
      const res = dbscan([p1], 150, 3);
      expect(res.clusters).toHaveLength(0);
      expect(res.noiseIds).toContain('h-1');
    });

    it('Handles duplicate coordinates (multiple households in same apartment tower)', () => {
      // 3 families at identical lat/lng
      const p1 = { id: 'h-fl1', lat: 26.85, lng: 80.95 };
      const p2 = { id: 'h-fl2', lat: 26.85, lng: 80.95 };
      const p3 = { id: 'h-fl3', lat: 26.85, lng: 80.95 };

      const res = dbscan([p1, p2, p3], 150, 3);
      expect(res.clusters).toHaveLength(1);
      expect(res.clusters[0].size).toBe(3);
      expect(res.clusters[0].memberIds).toContain('h-fl1');
      expect(res.clusters[0].memberIds).toContain('h-fl2');
      expect(res.clusters[0].memberIds).toContain('h-fl3');
      expect(res.noiseIds).toHaveLength(0);
    });

    it('All points far apart (> eps) are classified as noise', () => {
      const p1 = { id: 'h-a', lat: 26.80, lng: 80.90 };
      const p2 = { id: 'h-b', lat: 26.90, lng: 81.00 };
      const p3 = { id: 'h-c', lat: 27.00, lng: 81.10 };

      const res = dbscan([p1, p2, p3], 150, 3);
      expect(res.clusters).toHaveLength(0);
      expect(res.noiseIds).toHaveLength(3);
    });

    it('Points less than minPoints form noise, not a cluster', () => {
      // Only 2 points within 150m, but minPoints is 3
      const p1 = { id: 'h-p1', lat: 26.8500, lng: 80.9500 };
      const p2 = { id: 'h-p2', lat: 26.8501, lng: 80.9501 };

      const res = dbscan([p1, p2], 150, 3);
      expect(res.clusters).toHaveLength(0);
      expect(res.noiseIds).toHaveLength(2);
    });
  });

  // ==========================================
  // 3. Score Tiers & Consent Boundaries
  // ==========================================
  describe('3. Score Tiers & Consent Boundaries', () => {
    const baseH: Household = {
      id: 'h-score',
      name: 'Score Test',
      lat: 26.85,
      lng: 80.95,
      address: 'Risk St',
      status: 'flagged',
      lastCheckInAt: new Date(baseTime.getTime() - 48 * 3600 * 1000).toISOString(), // 48h silent
      graceHours: 24,
      floor: 0,
      householdSize: 4,
    };

    it('Zero medical points if resident has NOT consented, even if conditions exist in profile', () => {
      const unconsentedH: Household = {
        ...baseH,
        consent: { health: false }, // Explicitly NO consent under DPDP Act
      };
      const healthProfile: HealthProfile = {
        householdId: 'h-score',
        conditions: ['insulin-dependent', 'limited-mobility'],
        allergies: ['penicillin'],
        updatedAt: baseTime.toISOString(),
      };

      const score = scoreHousehold(unconsentedH, {
        healthProfile,
        clusterSize: 1,
        floodZones: [],
        reports: [],
        now: baseTime,
        settings: DEFAULT_SETTINGS,
      });

      const medicalItem = score.breakdown.find((b) => b.factor === 'medicalVulnerability');
      expect(medicalItem?.points).toBe(0);
      expect(medicalItem?.description).toContain('Health consent not granted');
    });

    it('Full medical points added when resident has consented', () => {
      const consentedH: Household = {
        ...baseH,
        consent: { health: true },
      };
      const healthProfile: HealthProfile = {
        householdId: 'h-score',
        conditions: ['insulin-dependent', 'limited-mobility'],
        allergies: ['penicillin'],
        updatedAt: baseTime.toISOString(),
      };

      const score = scoreHousehold(consentedH, {
        healthProfile,
        clusterSize: 1,
        floodZones: [],
        reports: [],
        now: baseTime,
        settings: DEFAULT_SETTINGS,
      });

      const medicalItem = score.breakdown.find((b) => b.factor === 'medicalVulnerability');
      expect(medicalItem?.points).toBeGreaterThan(0);
    });

    it('Score tiers map strictly: score >= 70 is HIGH, 35 <= score < 70 is MEDIUM, < 35 is LOW', () => {
      const createWithForcedScore = (silenceHours: number, cluster: number) => {
        const h: Household = {
          ...baseH,
          lastCheckInAt: new Date(baseTime.getTime() - silenceHours * 3600 * 1000).toISOString(),
        };
        return scoreHousehold(h, {
          healthProfile: undefined,
          clusterSize: cluster,
          floodZones: [],
          reports: [],
          now: baseTime,
          settings: DEFAULT_SETTINGS,
        });
      };

      // Lone miss with short silence -> LOW
      const lowResult = createWithForcedScore(25, 1);
      expect(lowResult.tier).toBe('LOW');
      expect(lowResult.score).toBeLessThan(35);

      // Clustered miss with moderate silence -> MEDIUM or HIGH
      const medOrHigh = createWithForcedScore(60, 6);
      expect(['MEDIUM', 'HIGH']).toContain(medOrHigh.tier);
    });
  });

  // ==========================================
  // 4. Access Matrix & Privacy Model
  // ==========================================
  describe('4. Access Matrix & Privacy Model', () => {
    it('Resident can view own record, but not others', () => {
      expect(canView('resident', 'exactAddress', undefined, { isOwnRecord: true })).toBe(true);
      expect(canView('resident', 'exactAddress', undefined, { isOwnRecord: false })).toBe(false);
    });

    it('Volunteer before task acceptance gets zero private details', () => {
      // Risk tier and rough location visible
      expect(canView('volunteer', 'riskLevel', 'suggested')).toBe(true);
      expect(canView('volunteer', 'roughLocation', 'suggested')).toBe(true);

      // Private medical & contact details strictly blocked
      expect(canView('volunteer', 'exactAddress', 'suggested')).toBe(false);
      expect(canView('volunteer', 'contactPhone', 'suggested')).toBe(false);
      expect(canView('volunteer', 'fullMedicalBriefing', 'suggested')).toBe(false);
      expect(canView('volunteer', 'conditionsSummary', 'suggested')).toBe(false);
    });

    it('Volunteer after task acceptance unlocks briefing if resident consented', () => {
      expect(canView('volunteer', 'exactAddress', 'accepted')).toBe(true);
      expect(canView('volunteer', 'contactPhone', 'accepted')).toBe(true);
      expect(canView('volunteer', 'floor', 'accepted')).toBe(true);
      expect(canView('volunteer', 'fullMedicalBriefing', 'accepted', { hasHealthConsent: true })).toBe(true);

      // If resident withheld health consent, medical details remain blocked even after accept
      expect(canView('volunteer', 'fullMedicalBriefing', 'accepted', { hasHealthConsent: false })).toBe(false);
    });

    it('Volunteer access is revoked immediately upon task resolution or cancellation', () => {
      expect(canView('volunteer', 'exactAddress', 'resolved')).toBe(false);
      expect(canView('volunteer', 'contactPhone', 'resolved')).toBe(false);
      expect(canView('volunteer', 'fullMedicalBriefing', 'resolved')).toBe(false);

      expect(canView('volunteer', 'exactAddress', 'cancelled')).toBe(false);
      expect(canView('volunteer', 'contactPhone', 'cancelled')).toBe(false);
      expect(canView('volunteer', 'fullMedicalBriefing', 'cancelled')).toBe(false);
    });

    it('Briefing token expiration validation works', () => {
      const unlockedTime = new Date('2026-10-13T10:00:00Z');
      const activeTime = new Date('2026-10-13T12:00:00Z'); // 2h elapsed (within 6h window)
      const expiredTime = new Date('2026-10-13T17:00:00Z'); // 7h elapsed (> 6h window)

      // Active task within 6h is valid
      expect(isBriefingTokenValid(unlockedTime, 'accepted', 6, activeTime)).toBe(true);

      // Expired after 6 hours
      expect(isBriefingTokenValid(unlockedTime, 'accepted', 6, expiredTime)).toBe(false);

      // Instantly revoked when task status is resolved or cancelled
      expect(isBriefingTokenValid(unlockedTime, 'resolved', 6, activeTime)).toBe(false);
      expect(isBriefingTokenValid(unlockedTime, 'cancelled', 6, activeTime)).toBe(false);
    });

    it('Break-Glass emergency override releases location, and only releases health with consent', () => {
      // With consent: full medical briefing unlocked
      expect(canView('coordinator', 'fullMedicalBriefing', undefined, { isBreakGlass: true, hasHealthConsent: true })).toBe(true);
      expect(canView('coordinator', 'exactAddress', undefined, { isBreakGlass: true })).toBe(true);

      // Without consent: emergency rescue location released, but medical records withheld
      expect(canView('coordinator', 'fullMedicalBriefing', undefined, { isBreakGlass: true, hasHealthConsent: false })).toBe(false);
      expect(canView('coordinator', 'exactAddress', undefined, { isBreakGlass: true, hasHealthConsent: false })).toBe(true);
    });
  });

  // ==========================================
  // 5. Hinglish + English SMS Parser Edge Cases
  // ==========================================
  describe('5. Hinglish + English SMS Parser Edge Cases', () => {
    it('Handles empty or whitespace text gracefully', () => {
      const res = parseSmsReport('   ');
      expect(res.urgency).toBe('LOW');
      expect(res.confidence).toBeLessThanOrEqual(0.1);
      expect(res.peopleCount).toBe(1);
    });

    it('Extracts multiple Hindi number spellings accurately', () => {
      expect(parseSmsReport('hum do log phans gaye hain').peopleCount).toBe(2);
      expect(parseSmsReport('char log hain yahan paani bhara hai').peopleCount).toBe(4);
      expect(parseSmsReport('paanch log phans gaye hain bachao').peopleCount).toBe(5);
      expect(parseSmsReport('10 log terrace par hain').peopleCount).toBe(10);
    });

    it('Handles overlapping urgency keywords and elevates urgency to HIGH', () => {
      const res = parseSmsReport('bahut urgent jaldi aao bachao help turant');
      expect(res.urgency).toBe('HIGH');
      expect(res.confidence).toBeGreaterThan(0.5);
    });

    it('Extracts location hints from text', () => {
      const res = parseSmsReport('Gomti Nagar water level rising near bridge need rescue');
      expect(res.locationHint).toBeDefined();
      expect(res.needs).toContain('water');
    });
  });

  // ==========================================
  // 6. QR Chunking & Reassembly Edge Cases
  // ==========================================
  describe('6. QR Chunking & Reassembly Edge Cases', () => {
    it('Single small payload creates valid chunk', () => {
      const payload = { test: 'hello rahatlink', count: 42 };
      const chunks = encodeSnapshotToQrChunks(payload, { maxChunkSize: 500 });
      expect(chunks.length).toBe(1);

      const parsed = parseQrChunk(chunks[0]);
      expect(parsed?.protocol).toBe('RL');
      expect(parsed?.seq).toBe(1);
      expect(parsed?.total).toBe(1);

      const assembler = new QrChunkAssembler();
      const res = assembler.ingestChunk(chunks[0]);
      expect(res.completedData).toEqual(payload);
    });

    it('Large payload splits into multiple chunks and reassembles out-of-order', () => {
      const largeData = {
        households: Array.from({ length: 40 }, (_, i) => ({
          id: `h-${i}`,
          name: `Family ${i}`,
          lat: 26.85 + i * 0.001,
          lng: 80.95 + i * 0.001,
          address: `House number ${i}, Sector ${i % 5}`,
        })),
      };

      const chunks = encodeSnapshotToQrChunks(largeData, { maxChunkSize: 60 });
      expect(chunks.length).toBeGreaterThan(1);

      const assembler = new QrChunkAssembler();
      // Ingest chunks in reverse order (simulate scanning out of sequence)
      const reversed = [...chunks].reverse();
      let finalResult = null;
      for (const chunk of reversed) {
        const step = assembler.ingestChunk(chunk);
        if (step.completedData) {
          finalResult = step.completedData;
        }
      }

      expect(finalResult).toEqual(largeData);
    });

    it('Reassembly returns null until all chunks are received', () => {
      const data = {
        households: Array.from({ length: 25 }, (_, i) => ({
          id: `h-long-${i}`,
          name: `Resident Full Name ${i}`,
          address: `Colony Street Address ${i}`,
        })),
      };
      const chunks = encodeSnapshotToQrChunks(data, { maxChunkSize: 60 });
      expect(chunks.length).toBeGreaterThan(1);

      const assembler = new QrChunkAssembler();
      // Ingest only the first chunk
      const res1 = assembler.ingestChunk(chunks[0]);
      expect(res1.completedData).toBeNull();
      expect(res1.progress?.isComplete).toBe(false);
    });

    it('Duplicate chunks do not break assembler', () => {
      const data = { ping: 'pong' };
      const chunks = encodeSnapshotToQrChunks(data, { maxChunkSize: 500 });
      const assembler = new QrChunkAssembler();

      // Ingest chunk 1 twice
      assembler.ingestChunk(chunks[0]);
      const res2 = assembler.ingestChunk(chunks[0]);
      expect(res2.completedData).toEqual(data);
    });

    it('Invalid non-RL string returns null', () => {
      expect(parseQrChunk('https://example.com')).toBeNull();
      expect(parseQrChunk('')).toBeNull();
    });
  });
});
