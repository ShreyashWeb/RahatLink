import { describe, it, expect } from 'vitest';
import {
  Household,
  HealthProfile,
  CheckIn,
  Report,
  Volunteer,
  Task,
  AccessLogEntry,
  FloodZone,
  Settings,
  DEFAULT_SETTINGS,
  DEFAULT_RISK_WEIGHTS,
} from './index';

describe('@rahatlink/core smoke test', () => {
  it('instantiates core types correctly', () => {
    const household: Household = {
      id: 'h-101',
      name: 'Sharma Residence',
      lat: 26.8467,
      lng: 80.9462,
      address: 'House 12, Gomti Nagar',
      floor: 1,
      contactPhone: '+919876543210',
      householdSize: 2,
      hasSmartphone: true,
      graceHours: 24,
      lastCheckInAt: new Date().toISOString(),
      lastBattery: 85,
      consent: { health: true, grantedAt: new Date().toISOString() },
      status: 'ok',
    };

    const healthProfile: HealthProfile = {
      householdId: household.id,
      conditions: ['diabetes', 'insulin-dependent'],
      allergies: ['penicillin'],
      medications: 'Insulin Glargine 10U daily',
      notes: 'Requires refrigerated insulin storage',
      updatedAt: new Date().toISOString(),
    };

    const checkIn: CheckIn = {
      id: 'c-1',
      householdId: household.id,
      at: new Date().toISOString(),
      by: 'self',
      batteryPct: 85,
    };

    const report: Report = {
      id: 'r-1',
      at: new Date().toISOString(),
      text: 'Water rising near house 12, elderly uncle not answering door',
      source: 'sms',
      parsed: {
        urgency: 'HIGH',
        needs: ['rescue', 'insulin'],
        matchedHouseholdId: household.id,
      },
    };

    const volunteer: Volunteer = {
      id: 'v-1',
      name: 'Priya Verma',
      skills: ['first-aid', 'boat'],
      equipment: ['life-jacket', 'first-aid-kit'],
      lat: 26.847,
      lng: 80.945,
      available: true,
    };

    const task: Task = {
      id: 't-1',
      householdIds: [household.id],
      riskTier: 'HIGH',
      score: 75,
      breakdown: [
        { factor: 'silenceBeyondGrace', points: 25, description: 'Silent 6h past grace (+25)' },
        { factor: 'medicalVulnerability', points: 25, description: 'Consented insulin dependence (+25)' },
        { factor: 'clusterSize', points: 25, description: 'Clustered with 3 silent neighbours (+25)' },
      ],
      status: 'suggested',
      createdAt: new Date().toISOString(),
    };

    const accessLog: AccessLogEntry = {
      id: 'a-1',
      at: new Date().toISOString(),
      actor: 'coord-1',
      role: 'coordinator',
      householdId: household.id,
      field: 'healthProfile',
      action: 'view',
      reason: 'Dispatch review for high-risk flood zone',
    };

    const floodZone: FloodZone = {
      id: 'fz-1',
      name: 'Gomti Riverbank Sector A',
      polygon: [
        [26.85, 80.94],
        [26.852, 80.945],
        [26.848, 80.95],
      ],
    };

    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      disasterMode: true,
      disasterGraceFactor: 0.5,
    };

    expect(household.status).toBe('ok');
    expect(healthProfile.conditions).toContain('insulin-dependent');
    expect(checkIn.by).toBe('self');
    expect(report.source).toBe('sms');
    expect(volunteer.skills).toContain('first-aid');
    expect(task.riskTier).toBe('HIGH');
    expect(accessLog.action).toBe('view');
    expect(floodZone.polygon.length).toBe(3);
    expect(settings.disasterMode).toBe(true);
    expect(DEFAULT_RISK_WEIGHTS.silenceBeyondGrace).toBe(25);
  });
});
