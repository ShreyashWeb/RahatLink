import type { AccessRole, TaskStatus } from './types';

export type PrivacyField =
  | 'riskLevel'
  | 'keyNeeds'
  | 'distance'
  | 'roughLocation'
  | 'conditionsSummary'
  | 'exactAddress'
  | 'floor'
  | 'contactPhone'
  | 'fullMedicalBriefing';

export interface CanViewOptions {
  isOwnRecord?: boolean;
  isBreakGlass?: boolean;
  hasHealthConsent?: boolean;
}

/**
 * DPDP Act-compliant Access Matrix.
 * Controls data access across roles and lifecycle task states.
 *
 * Rules:
 * - Resident: own data, always.
 * - Coordinator: risk level and key needs always; conditions as a summary only;
 *   exact address/floor/contact only while an incident is open (for dispatch).
 * - Volunteer before accept: nothing private (risk tier, distance, rough area only).
 * - Volunteer after accept: full briefing until task is resolved or cancelled.
 * - Break-glass: if consent exists, coordinator can release medical briefing.
 *   If consent was NOT given, break-glass releases non-medical location only.
 */
export function canView(
  role: AccessRole,
  field: PrivacyField,
  taskState?: TaskStatus,
  options: CanViewOptions = {},
): boolean {
  const { isOwnRecord = false, isBreakGlass = false, hasHealthConsent = true } = options;

  // 1. Resident: own data, always
  if (role === 'resident') {
    return isOwnRecord;
  }

  // 2. Break-glass override
  if (isBreakGlass) {
    if (field === 'fullMedicalBriefing' || field === 'conditionsSummary') {
      // Medical info only released if resident consented to emergency health sharing
      return Boolean(hasHealthConsent);
    }
    // Location and contact are released for life-saving rescue even if medical consent was withheld
    return true;
  }

  // 3. Coordinator access rules
  if (role === 'coordinator') {
    // Risk level, key needs, distance, rough location, conditions summary: always visible
    if (
      field === 'riskLevel' ||
      field === 'keyNeeds' ||
      field === 'distance' ||
      field === 'roughLocation' ||
      field === 'conditionsSummary'
    ) {
      return true;
    }

    // Exact address, floor, contact phone: only while incident is active/open
    const isIncidentOpen =
      taskState === 'suggested' ||
      taskState === 'approved' ||
      taskState === 'accepted' ||
      taskState === 'overridden';

    if (field === 'exactAddress' || field === 'floor' || field === 'contactPhone') {
      return isIncidentOpen;
    }

    // Full medical dossier (raw prescriptions, notes) is withheld from general coordinator view
    // to preserve resident dignity; available via break-glass with logged justification
    if (field === 'fullMedicalBriefing') {
      return false;
    }

    return false;
  }

  // 4. Volunteer access rules
  if (role === 'volunteer') {
    // Volunteer before accept (suggested, approved, unassigned, etc.)
    if (taskState !== 'accepted') {
      // Risk tier, distance, rough area only
      return field === 'riskLevel' || field === 'distance' || field === 'roughLocation' || field === 'keyNeeds';
    }

    // Volunteer after accept: full briefing until task is resolved or cancelled
    if (taskState === 'accepted') {
      if (field === 'fullMedicalBriefing') {
        return Boolean(hasHealthConsent);
      }
      return true;
    }

    // After resolve or cancel: all private fields are revoked
    return field === 'riskLevel' || field === 'distance';
  }

  // Neighbour: non-medical proxy check-in only
  if (role === 'neighbour') {
    return field === 'riskLevel' || field === 'distance' || field === 'roughLocation';
  }

  return false;
}

/**
 * Validates whether an unlocked briefing token remains active.
 * Tokens expire when the task is resolved/cancelled or after maxDurationHours (default 6h).
 */
export function isBriefingTokenValid(
  unlockedAt: string | Date | number,
  taskStatus: TaskStatus,
  maxDurationHours: number = 6,
  now: Date = new Date(),
): boolean {
  // Access immediately revokes upon task resolution or cancellation
  if (taskStatus === 'resolved' || taskStatus === 'cancelled') {
    return false;
  }

  const unlockTimeMs = new Date(unlockedAt).getTime();
  if (isNaN(unlockTimeMs)) return false;

  const elapsedMs = now.getTime() - unlockTimeMs;
  const maxMs = maxDurationHours * 3600 * 1000;

  return elapsedMs >= 0 && elapsedMs < maxMs;
}

export const MEDICAL_DISCLAIMER =
  'Self-reported by the resident. Not professional medical advice.';
