import { describe, it, expect } from 'vitest';
import { evaluateHousehold, CHECKIN_CADENCE_HOURS } from './silence';
import { Household, Settings, DEFAULT_SETTINGS } from './index';

describe('Silence Escalation Ladder Engine (packages/core/src/silence.ts)', () => {
  const baseTime = new Date('2026-10-13T12:00:00Z');

  const createHousehold = (overrides: Partial<Household> = {}): Household => ({
    id: 'h-test',
    name: 'Test Resident',
    lat: 26.85,
    lng: 80.95,
    address: '123 Safe St',
    contactPhone: '+91 99999 99999',
    householdSize: 2,
    hasSmartphone: true,
    graceHours: 24, // 24 hours base grace = 1440 min
    lastCheckInAt: baseTime.toISOString(),
    lastBattery: 80,
    consent: { health: true },
    status: 'ok',
    ...overrides,
  });

  const normalSettings: Settings = {
    ...DEFAULT_SETTINGS,
    disasterMode: false,
    disasterGraceFactor: 0.5,
  };

  const disasterSettings: Settings = {
    ...DEFAULT_SETTINGS,
    disasterMode: true,
    disasterGraceFactor: 0.5, // 24h grace halved to 12h = 720 min
  };

  it('1. Normal day: check-in is recent (t < 24h) -> status "ok"', () => {
    const h = createHousehold();
    // 5 hours after last check-in
    const now = new Date(baseTime.getTime() + 5 * 3600 * 1000);
    const result = evaluateHousehold(h, now, normalSettings);

    expect(result.status).toBe('ok');
    expect(result.minutesSilent).toBe(300);
    expect(result.likelyDeadPhone).toBe(false);
    expect(result.needsProxy).toBe(false);
  });

  it('2. Missed by 1 h: (24h + 1h = 25h silent) -> status "due"', () => {
    const h = createHousehold(); // grace = 24h, 0.25*grace = 6h. 'due' window is 24h to 30h.
    // 25 hours after last check-in
    const now = new Date(baseTime.getTime() + 25 * 3600 * 1000);
    const result = evaluateHousehold(h, now, normalSettings);

    expect(result.status).toBe('due');
    expect(result.minutesSilent).toBe(1500);
  });

  it('3. Each stage boundary with standard 24h grace window:', () => {
    const h = createHousehold({ graceHours: 24 });
    // Cadence = 1440 min. Grace = 1440 min.
    // Due: [1440, 1440 + 360) = [1440, 1800) -> 24h to 30h
    // Grace: [1800, 1440 + 1440) = [1800, 2880) -> 30h to 48h
    // Reminded: [2880, 2880 + 360) = [2880, 3240) -> 48h to 54h
    // Pinged: [3240, 3240 + 360) = [3240, 3600) -> 54h to 60h
    // Flagged: >= 3600 -> >= 60h

    // Exactly at 29h -> 'due'
    expect(evaluateHousehold(h, new Date(baseTime.getTime() + 29 * 3600 * 1000), normalSettings).status).toBe('due');

    // Exactly at 31h -> 'grace'
    expect(evaluateHousehold(h, new Date(baseTime.getTime() + 31 * 3600 * 1000), normalSettings).status).toBe('grace');

    // Exactly at 49h -> 'reminded'
    expect(evaluateHousehold(h, new Date(baseTime.getTime() + 49 * 3600 * 1000), normalSettings).status).toBe('reminded');

    // Exactly at 55h -> 'pinged'
    expect(evaluateHousehold(h, new Date(baseTime.getTime() + 55 * 3600 * 1000), normalSettings).status).toBe('pinged');

    // Exactly at 61h -> 'flagged'
    expect(evaluateHousehold(h, new Date(baseTime.getTime() + 61 * 3600 * 1000), normalSettings).status).toBe('flagged');
  });

  it('4. Disaster-mode shortening: grace is halved (0.5x)', () => {
    const h = createHousehold({ graceHours: 24 });
    // In disaster mode, grace = 12h = 720 min.
    // 0.25*grace = 3h = 180 min.
    // Cadence = 24h.
    // Due: 24h to 27h
    // Grace: 27h to 36h
    // Reminded: 36h to 39h
    // Pinged: 39h to 42h
    // Flagged: >= 42h

    // In normal mode at 43h it would only be in 'grace'. In disaster mode at 43h it is already 'flagged'!
    const at43h = new Date(baseTime.getTime() + 43 * 3600 * 1000);
    const normalEval = evaluateHousehold(h, at43h, normalSettings);
    const disasterEval = evaluateHousehold(h, at43h, disasterSettings);

    expect(normalEval.status).toBe('grace');
    expect(disasterEval.status).toBe('flagged');
  });

  it('5. seenSafe reset: resets the clock and clears escalation ladder', () => {
    // Household was confirmed seen safe recently (2 hours ago)
    const seenSafeTime = new Date(baseTime.getTime() + 50 * 3600 * 1000);
    const h = createHousehold({
      status: 'seenSafe',
      lastCheckInAt: seenSafeTime.toISOString(),
    });

    const now = new Date(seenSafeTime.getTime() + 2 * 3600 * 1000);
    const result = evaluateHousehold(h, now, normalSettings);

    expect(result.status).toBe('seenSafe');
    expect(result.minutesSilent).toBe(120);
  });

  it('6. Dead-phone flag: battery <= 5% triggers likelyDeadPhone', () => {
    const hLowBattery = createHousehold({ lastBattery: 3 });
    const hNormalBattery = createHousehold({ lastBattery: 45 });

    const evalLow = evaluateHousehold(hLowBattery, new Date(baseTime.getTime() + 35 * 3600 * 1000), normalSettings);
    const evalNormal = evaluateHousehold(hNormalBattery, new Date(baseTime.getTime() + 35 * 3600 * 1000), normalSettings);

    expect(evalLow.likelyDeadPhone).toBe(true);
    expect(evalNormal.likelyDeadPhone).toBe(false);
  });

  it('7. No-smartphone household: marks needsProxy: true', () => {
    const hNoPhone = createHousehold({ hasSmartphone: false });
    const hWithPhone = createHousehold({ hasSmartphone: true });

    const evalNoPhone = evaluateHousehold(hNoPhone, baseTime, normalSettings);
    const evalWithPhone = evaluateHousehold(hWithPhone, baseTime, normalSettings);

    expect(evalNoPhone.needsProxy).toBe(true);
    expect(evalWithPhone.needsProxy).toBe(false);
  });
});
