import { describe, it, expect } from 'vitest';
import { parseSmsReport, createReportFromSms } from './parse';
import type { Household } from './types';

const SAMPLE_HOUSEHOLDS: Household[] = [
  {
    id: 'h-101',
    name: 'Sharma Residence',
    lat: 26.8467,
    lng: 80.9462,
    address: 'House 12, Gomti Nagar, Lucknow',
    floor: 1,
    householdSize: 2,
    hasSmartphone: true,
    graceHours: 24,
    lastCheckInAt: new Date().toISOString(),
    status: 'ok',
  },
  {
    id: 'h-102',
    name: 'Verma Family',
    lat: 26.8475,
    lng: 80.947,
    address: 'Plot 45, Sector 5, Gomti Nagar',
    floor: 2,
    householdSize: 4,
    hasSmartphone: true,
    graceHours: 24,
    lastCheckInAt: new Date().toISOString(),
    status: 'ok',
  },
  {
    id: 'h-103',
    name: 'Gupta Household',
    lat: 26.8482,
    lng: 80.9455,
    address: 'Near Old Riverbank Bridge, Gomti Nagar',
    floor: 0,
    householdSize: 3,
    hasSmartphone: false,
    graceHours: 12,
    lastCheckInAt: new Date().toISOString(),
    status: 'flagged',
  },
];

describe('Hinglish & English SMS Parser (parseSmsReport)', () => {
  // Test 1: Specified prompt example
  it('1. parses "sector 5 me 3 log phans gaye, ek diabetic hai, jaldi"', () => {
    const text = 'sector 5 me 3 log phans gaye, ek diabetic hai, jaldi';
    const parsed = parseSmsReport(text, { households: SAMPLE_HOUSEHOLDS });

    expect(parsed.urgency).toBe('HIGH');
    expect(parsed.needs).toContain('rescue');
    expect(parsed.needs).toContain('medical');
    expect(parsed.peopleCount).toBe(3);
    expect(parsed.matchedHouseholdId).toBe('h-102'); // Verma Family at Sector 5
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.7);
  });

  // Test 2: Extreme urgency in Hindi with flood context
  it('2. parses "bachao bachao paani chhat tak aa gaya 4 log fas gaye"', () => {
    const text = 'bachao bachao paani chhat tak aa gaya 4 log fas gaye';
    const parsed = parseSmsReport(text);

    expect(parsed.urgency).toBe('HIGH');
    expect(parsed.needs).toContain('rescue');
    expect(parsed.peopleCount).toBe(4);
  });

  // Test 3: Medical emergency with insulin typo and Hinglish
  it('3. parses "elderly uncle ko insuln dawa chahiye turant sharma residence"', () => {
    const text = 'elderly uncle ko insuln dawa chahiye turant sharma residence';
    const parsed = parseSmsReport(text, { households: SAMPLE_HOUSEHOLDS });

    expect(parsed.urgency).toBe('HIGH');
    expect(parsed.needs).toContain('medical');
    expect(parsed.matchedHouseholdId).toBe('h-101'); // Sharma Residence
  });

  // Test 4: Water and food need
  it('4. parses "water khatam ho gaya hai and rashan khana bhi nahi hai 5 family members"', () => {
    const text = 'water khatam ho gaya hai and rashan khana bhi nahi hai 5 family members';
    const parsed = parseSmsReport(text);

    expect(parsed.needs).toContain('water');
    expect(parsed.needs).toContain('food');
    expect(parsed.peopleCount).toBe(5);
  });

  // Test 5: Hindi number word 'do' with wheelchair mobility need
  it('5. parses "do log hain wheelchair par chal nahi sakte riverbank bridge"', () => {
    const text = 'do log hain wheelchair par chal nahi sakte riverbank bridge';
    const parsed = parseSmsReport(text, { households: SAMPLE_HOUSEHOLDS });

    expect(parsed.peopleCount).toBe(2);
    expect(parsed.needs).toContain('mobility-assist');
    expect(parsed.matchedHouseholdId).toBe('h-103'); // Riverbank
  });

  // Test 6: Hindi number word 'paanch'
  it('6. parses "paanch log phans gaye hain naav bhejo urgent"', () => {
    const text = 'paanch log phans gaye hain naav bhejo urgent';
    const parsed = parseSmsReport(text);

    expect(parsed.urgency).toBe('HIGH');
    expect(parsed.peopleCount).toBe(5);
    expect(parsed.needs).toContain('rescue');
  });

  // Test 7: Coordinates in SMS
  it('7. parses explicit coordinates "Help! Water rising fast at 26.8467, 80.9462"', () => {
    const text = 'Help! Water rising fast at 26.8467, 80.9462';
    const parsed = parseSmsReport(text);

    expect(parsed.urgency).toBe('HIGH');
    expect(parsed.lat).toBeCloseTo(26.8467, 4);
    expect(parsed.lng).toBeCloseTo(80.9462, 4);
  });

  // Test 8: Pregnant resident with urgent boat need
  it('8. parses "pregnant lady in labor boat urgently needed sec 5"', () => {
    const text = 'pregnant lady in labor boat urgently needed sec 5';
    const parsed = parseSmsReport(text, { households: SAMPLE_HOUSEHOLDS });

    expect(parsed.urgency).toBe('HIGH');
    expect(parsed.needs).toContain('medical');
    expect(parsed.matchedHouseholdId).toBe('h-102');
  });

  // Test 9: Typo in "urgnt" and "mdeical"
  it('9. parses "urgnt mdeical attak bimar baccha"', () => {
    const text = 'urgnt mdeical attak bimar baccha';
    const parsed = parseSmsReport(text);

    expect(parsed.urgency).toBe('HIGH');
    expect(parsed.needs).toContain('medical');
  });

  // Test 10: Hindi number word 'teen' with trapped roof context
  it('10. parses "teen log chhat par khade hain paani badh raha"', () => {
    const text = 'teen log chhat par khade hain paani badh raha';
    const parsed = parseSmsReport(text);

    expect(parsed.peopleCount).toBe(3);
    expect(parsed.urgency).toBe('HIGH');
    expect(parsed.needs).toContain('rescue');
  });

  // Test 11: Food and clean drinking water request
  it('11. parses "peene ka pani aur bacchon ke liye dudh khana chahiye 4 people"', () => {
    const text = 'peene ka pani aur bacchon ke liye dudh khana chahiye 4 people';
    const parsed = parseSmsReport(text);

    expect(parsed.peopleCount).toBe(4);
    expect(parsed.needs).toContain('water');
    expect(parsed.needs).toContain('food');
  });

  // Test 12: High urgency Hindi 'turant bachao'
  it('12. parses "turant bachao gomti nagar house 12 doob raha"', () => {
    const text = 'turant bachao gomti nagar house 12 doob raha';
    const parsed = parseSmsReport(text, { households: SAMPLE_HOUSEHOLDS });

    expect(parsed.urgency).toBe('HIGH');
    expect(parsed.matchedHouseholdId).toBe('h-101'); // House 12 Gomti Nagar
  });

  // Test 13: Asthmatic inhaler emergency
  it('13. parses "inhaler asthma attack severe breathing problem help"', () => {
    const text = 'inhaler asthma attack severe breathing problem help';
    const parsed = parseSmsReport(text);

    expect(parsed.urgency).toBe('HIGH');
    expect(parsed.needs).toContain('medical');
  });

  // Test 14: General low urgency inquiry
  it('14. parses low-urgency informational message "water level normal in our lane currently"', () => {
    const text = 'water level normal in our lane currently';
    const parsed = parseSmsReport(text);

    expect(parsed.urgency).toBe('LOW');
  });

  // Test 15: createReportFromSms wrapper
  it('15. creates full Report structure with auto-generated ID and timestamp', () => {
    const report = createReportFromSms(
      '+919876543210',
      'jaldi aao verma family plot 45 me pani ghus gaya',
      SAMPLE_HOUSEHOLDS,
    );

    expect(report.id).toMatch(/^rep-sms-/);
    expect(report.from).toBe('+919876543210');
    expect(report.source).toBe('sms');
    expect(report.status).toBe('linked');
    expect(report.parsed?.matchedHouseholdId).toBe('h-102');
    expect(report.parsed?.urgency).toBe('HIGH');
  });
});
