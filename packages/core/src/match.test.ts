import { describe, it, expect } from 'vitest';
import { rankVolunteers, assign } from './match';
import type { Task, Volunteer, Household, HealthProfile } from './types';

describe('Volunteer Matching Engine (packages/core/src/match.ts)', () => {
  const households: Household[] = [
    {
      id: 'h-1',
      name: 'Verma Residence',
      lat: 26.847,
      lng: 80.946,
      address: 'Gomti Nagar',
      floor: 1,
      householdSize: 2,
      hasSmartphone: true,
      graceHours: 24,
      consent: { health: true },
      status: 'flagged',
    },
    {
      id: 'h-2',
      name: 'Sharma Residence',
      lat: 26.849,
      lng: 80.948,
      address: 'Riverbank Colony',
      floor: 0,
      householdSize: 3,
      hasSmartphone: true,
      graceHours: 24,
      consent: { health: false },
      status: 'flagged',
    },
  ];

  const healthProfiles = new Map<string, HealthProfile>([
    [
      'h-1',
      {
        householdId: 'h-1',
        conditions: ['insulin-dependent', 'limited-mobility'],
        allergies: [],
        updatedAt: new Date().toISOString(),
      },
    ],
  ]);

  const volunteers: Volunteer[] = [
    {
      id: 'v-1',
      name: 'Dr. Priya (Doctor, Close)',
      skills: ['medical', 'first-aid'],
      equipment: ['first-aid-kit', 'glucose-monitor'],
      lat: 26.8472, // ~30m from h-1
      lng: 80.9462,
      available: true,
    },
    {
      id: 'v-2',
      name: 'Sandeep (Boat Operator, Far)',
      skills: ['boat'],
      equipment: ['boat', 'life-jacket'],
      lat: 26.86, // ~1.5km away
      lng: 80.96,
      available: true,
    },
    {
      id: 'v-3',
      name: 'Amit (Unavailable Medic)',
      skills: ['medical', 'first-aid'],
      equipment: ['first-aid-kit'],
      lat: 26.8471,
      lng: 80.9461,
      available: false, // unavailable
    },
  ];

  it('ranks volunteers by skills, equipment, proximity and applies unavailable penalty', () => {
    const task: Task = {
      id: 't-1',
      householdIds: ['h-1'],
      riskTier: 'HIGH',
      score: 85,
      breakdown: [],
      status: 'suggested',
      createdAt: new Date().toISOString(),
    };

    const ranked = rankVolunteers(task, volunteers, households, healthProfiles);

    expect(ranked.length).toBe(3);
    // Dr. Priya (v-1) has medical skills, equipment, and close proximity
    expect(ranked[0].volunteer.id).toBe('v-1');
    expect(ranked[0].fitScore).toBeGreaterThan(ranked[1].fitScore);
    expect(ranked[0].breakdown.skillsScore).toBeGreaterThan(0);
    expect(ranked[0].breakdown.equipmentScore).toBeGreaterThan(0);
    expect(ranked[0].breakdown.distanceMeters).toBeLessThan(100);

    // v-3 is penalized for being unavailable
    const v3Rank = ranked.find((r) => r.volunteer.id === 'v-3');
    expect(v3Rank?.breakdown.penalty).toBe(50);
  });

  it('assigns two urgent tasks to two distinct volunteers with no double assignment', () => {
    const task1: Task = {
      id: 'task-high-1',
      householdIds: ['h-1'],
      riskTier: 'HIGH',
      score: 90,
      breakdown: [],
      status: 'approved',
      createdAt: new Date().toISOString(),
    };

    const task2: Task = {
      id: 'task-high-2',
      householdIds: ['h-2'],
      riskTier: 'HIGH',
      score: 80,
      breakdown: [],
      status: 'approved',
      createdAt: new Date().toISOString(),
    };

    const result = assign([task1, task2], volunteers, households, healthProfiles);

    expect(result.assignments.length).toBe(2);
    // Ensure two unique volunteers are assigned
    const assignedIds = result.assignments.map((a) => a.volunteerId);
    const uniqueIds = new Set(assignedIds);
    expect(uniqueIds.size).toBe(2);

    // Neither task should be double-assigned to the same volunteer
    expect(assignedIds[0]).not.toBe(assignedIds[1]);
    expect(result.unassignedTaskIds.length).toBe(0);
  });

  it('handles case with more urgent tasks than available volunteers gracefully', () => {
    const tasks: Task[] = [
      {
        id: 't-1',
        householdIds: ['h-1'],
        riskTier: 'HIGH',
        score: 95,
        breakdown: [],
        status: 'approved',
        createdAt: new Date().toISOString(),
      },
      {
        id: 't-2',
        householdIds: ['h-2'],
        riskTier: 'HIGH',
        score: 85,
        breakdown: [],
        status: 'approved',
        createdAt: new Date().toISOString(),
      },
      {
        id: 't-3',
        householdIds: ['h-2'],
        riskTier: 'MEDIUM',
        score: 60,
        breakdown: [],
        status: 'approved',
        createdAt: new Date().toISOString(),
      },
    ];

    // Only 2 available volunteers (v-1 and v-2)
    const result = assign(tasks, volunteers, households, healthProfiles);

    expect(result.assignments.length).toBe(2);
    expect(result.unassignedTaskIds).toContain('t-3');
  });
});
