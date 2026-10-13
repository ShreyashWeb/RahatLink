import type {
  Task,
  Volunteer,
  Household,
  HealthProfile,
} from './types';
import { haversine } from './cluster';

export interface FitBreakdown {
  skillsScore: number;
  equipmentScore: number;
  distanceScore: number;
  penalty: number;
  distanceMeters: number;
  matchedNeeds: string[];
}

export interface RankedVolunteer {
  volunteer: Volunteer;
  fitScore: number;
  breakdown: FitBreakdown;
}

export interface AssignmentResult {
  assignments: Array<{
    taskId: string;
    volunteerId: string;
    fitScore: number;
    volunteerName: string;
  }>;
  unassignedTaskIds: string[];
}

// Key emergency needs taxonomy
export type TaskNeed = 'first-aid' | 'medical' | 'boat' | 'mobility-assist';

/**
 * Derives operational needs from households and consented health tags
 */
export function deriveTaskNeeds(
  householdIds: string[],
  households: Household[],
  healthProfiles?: Map<string, HealthProfile> | Record<string, HealthProfile>,
): TaskNeed[] {
  const needs = new Set<TaskNeed>();

  for (const hId of householdIds) {
    const h = households.find((item) => item.id === hId);
    if (!h) continue;

    // Check health conditions if consent granted
    let profile: HealthProfile | undefined;
    if (healthProfiles) {
      profile = healthProfiles instanceof Map ? healthProfiles.get(hId) : healthProfiles[hId];
    }

    if (h.consent?.health && profile?.conditions) {
      const conds = profile.conditions.map((c) => c.toLowerCase());
      if (conds.some((c) => c.includes('insulin') || c.includes('oxygen') || c.includes('diabet'))) {
        needs.add('medical');
      }
      if (conds.some((c) => c.includes('mobility') || c.includes('bedridden') || c.includes('wheelchair'))) {
        needs.add('mobility-assist');
      }
    }

    // Default baseline requirement for silent welfare check
    needs.add('first-aid');
  }

  return Array.from(needs);
}

/**
 * Calculates centroid coordinates for a task's households
 */
function getTaskCenter(
  householdIds: string[],
  households: Household[],
): { lat: number; lng: number } {
  const matched = households.filter((h) => householdIds.includes(h.id));
  if (matched.length === 0) return { lat: 26.847, lng: 80.946 }; // fallback default

  const avgLat = matched.reduce((sum, h) => sum + h.lat, 0) / matched.length;
  const avgLng = matched.reduce((sum, h) => sum + h.lng, 0) / matched.length;
  return { lat: avgLat, lng: avgLng };
}

/**
 * Ranks volunteers by matching skills, equipment, and haversine proximity to a task
 */
export function rankVolunteers(
  task: Task,
  volunteers: Volunteer[],
  households: Household[],
  healthProfiles?: Map<string, HealthProfile> | Record<string, HealthProfile>,
): RankedVolunteer[] {
  const center = getTaskCenter(task.householdIds, households);
  const taskNeeds = deriveTaskNeeds(task.householdIds, households, healthProfiles);

  const ranked: RankedVolunteer[] = volunteers.map((vol) => {
    // 1. Skills match (up to 40 pts)
    const volSkills = (vol.skills || []).map((s) => s.toLowerCase());
    const matchedNeeds = taskNeeds.filter((need) =>
      volSkills.some((s) => s.includes(need) || (need === 'medical' && s === 'doctor')),
    );
    const skillsScore = Math.min(40, matchedNeeds.length * 20);

    // 2. Equipment match (up to 30 pts)
    const volEquip = (vol.equipment || []).map((e) => e.toLowerCase());
    let equipScore = 0;
    if (taskNeeds.includes('first-aid') && volEquip.some((e) => e.includes('first-aid'))) {
      equipScore += 15;
    }
    if (taskNeeds.includes('medical') && volEquip.some((e) => e.includes('medical') || e.includes('kit'))) {
      equipScore += 15;
    }
    if (taskNeeds.includes('boat') && volEquip.some((e) => e.includes('boat') || e.includes('jacket'))) {
      equipScore += 15;
    }
    const equipmentScore = Math.min(30, equipScore);

    // 3. Proximity score (up to 30 pts based on haversine distance)
    const distMeters = Math.round(haversine(center, { lat: vol.lat, lng: vol.lng }));
    // 0m = 30pts, 2000m+ = 0pts
    const distanceScore = Math.max(0, Math.round(30 * (1 - distMeters / 2000)));

    // 4. Unavailable penalty (-50 pts)
    const penalty = vol.available ? 0 : 50;

    const fitScore = Math.max(0, skillsScore + equipmentScore + distanceScore - penalty);

    return {
      volunteer: vol,
      fitScore,
      breakdown: {
        skillsScore,
        equipmentScore,
        distanceScore,
        penalty,
        distanceMeters: distMeters,
        matchedNeeds,
      },
    };
  });

  // Sort descending by fitScore
  return ranked.sort((a, b) => b.fitScore - a.fitScore);
}

/**
 * Greedy global assignment ensuring one volunteer is not given two urgent tasks
 */
export function assign(
  tasks: Task[],
  volunteers: Volunteer[],
  households: Household[] = [],
  healthProfiles?: Map<string, HealthProfile> | Record<string, HealthProfile>,
): AssignmentResult {
  // Sort tasks by urgency tier and score
  const tierWeight: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const sortedTasks = [...tasks].sort((a, b) => {
    const tierDiff = (tierWeight[b.riskTier] || 1) - (tierWeight[a.riskTier] || 1);
    if (tierDiff !== 0) return tierDiff;
    return b.score - a.score;
  });

  const assignedVolunteers = new Set<string>();
  const assignments: AssignmentResult['assignments'] = [];
  const unassignedTaskIds: string[] = [];

  for (const task of sortedTasks) {
    // Only assign active or suggested/approved tasks
    if (task.status === 'resolved' || task.status === 'cancelled') continue;

    // Filter available volunteers not yet assigned in this pass
    const candidates = volunteers.filter((v) => !assignedVolunteers.has(v.id) && v.available);

    if (candidates.length === 0) {
      unassignedTaskIds.push(task.id);
      continue;
    }

    const ranked = rankVolunteers(task, candidates, households, healthProfiles);
    const best = ranked[0];

    if (best && best.fitScore > 0) {
      assignedVolunteers.add(best.volunteer.id);
      assignments.push({
        taskId: task.id,
        volunteerId: best.volunteer.id,
        fitScore: best.fitScore,
        volunteerName: best.volunteer.name,
      });
    } else {
      unassignedTaskIds.push(task.id);
    }
  }

  return { assignments, unassignedTaskIds };
}
