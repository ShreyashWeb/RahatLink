import type { Household, HouseholdStatus, Settings } from './types';

export interface SilenceEvaluation {
  status: HouseholdStatus;
  minutesSilent: number;
  graceMinutes: number;
  nextStageAt: Date | null;
  likelyDeadPhone: boolean;
  needsProxy: boolean;
  stageName: string;
}

export const CHECKIN_CADENCE_HOURS = 24;
export const CHECKIN_CADENCE_MINUTES = CHECKIN_CADENCE_HOURS * 60; // 1440 minutes

/**
 * Pure evaluation function for household silence escalation ladder.
 *
 * Ladder stages based on elapsed time t since lastCheckInAt:
 * 1. t < 24h: 'ok'
 * 2. 24h <= t < 24h + 0.25 * grace: 'due'
 * 3. 24h + 0.25 * grace <= t < 24h + 1.0 * grace: 'grace'
 * 4. 24h + 1.0 * grace <= t < 24h + 1.25 * grace: 'reminded'
 * 5. 24h + 1.25 * grace <= t < 24h + 1.50 * grace: 'pinged'
 * 6. t >= 24h + 1.50 * grace: 'flagged'
 */
export function evaluateHousehold(
  h: Household,
  now: Date = new Date(),
  settings: Settings,
): SilenceEvaluation {
  const needsProxy = !h.hasSmartphone;
  const likelyDeadPhone = Boolean(h.lastBattery !== undefined && h.lastBattery <= 5);

  // Compute effective grace window in minutes
  const baseGraceMinutes = (h.graceHours || 24) * 60;
  const graceMultiplier = settings.disasterMode
    ? settings.disasterGraceFactor ?? 0.5
    : 1.0;
  const graceMinutes = Math.round(baseGraceMinutes * graceMultiplier);

  // If never checked in, treat as deeply silent / flagged
  if (!h.lastCheckInAt) {
    return {
      status: 'flagged',
      minutesSilent: 999999,
      graceMinutes,
      nextStageAt: null,
      likelyDeadPhone,
      needsProxy,
      stageName: 'Flagged (No record)',
    };
  }

  const lastCheckInTime = new Date(h.lastCheckInAt).getTime();
  const nowTime = now.getTime();
  const diffMs = Math.max(0, nowTime - lastCheckInTime);
  const minutesSilent = Math.floor(diffMs / 60000);

  // If marked 'seenSafe' and still within the 24h cadence, clock was reset
  if (h.status === 'seenSafe' && minutesSilent < CHECKIN_CADENCE_MINUTES) {
    return {
      status: 'seenSafe',
      minutesSilent,
      graceMinutes,
      nextStageAt: new Date(lastCheckInTime + CHECKIN_CADENCE_MINUTES * 60000),
      likelyDeadPhone,
      needsProxy,
      stageName: 'Seen Safe (Clock Reset)',
    };
  }

  // Stage boundaries in minutes
  const cadence = CHECKIN_CADENCE_MINUTES; // 1440
  const tDue = cadence;
  const tGrace = cadence + 0.25 * graceMinutes;
  const tReminded = cadence + 1.0 * graceMinutes;
  const tPinged = cadence + 1.25 * graceMinutes;
  const tFlagged = cadence + 1.5 * graceMinutes;

  if (minutesSilent < tDue) {
    return {
      status: 'ok',
      minutesSilent,
      graceMinutes,
      nextStageAt: new Date(lastCheckInTime + tDue * 60000),
      likelyDeadPhone,
      needsProxy,
      stageName: 'OK (Within 24h cadence)',
    };
  }

  if (minutesSilent < tGrace) {
    return {
      status: 'due',
      minutesSilent,
      graceMinutes,
      nextStageAt: new Date(lastCheckInTime + tGrace * 60000),
      likelyDeadPhone,
      needsProxy,
      stageName: 'Due (Missed check-in window)',
    };
  }

  if (minutesSilent < tReminded) {
    return {
      status: 'grace',
      minutesSilent,
      graceMinutes,
      nextStageAt: new Date(lastCheckInTime + tReminded * 60000),
      likelyDeadPhone,
      needsProxy,
      stageName: 'Grace Period',
    };
  }

  if (minutesSilent < tPinged) {
    return {
      status: 'reminded',
      minutesSilent,
      graceMinutes,
      nextStageAt: new Date(lastCheckInTime + tPinged * 60000),
      likelyDeadPhone,
      needsProxy,
      stageName: 'Reminded (Automated nudge sent)',
    };
  }

  if (minutesSilent < tFlagged) {
    return {
      status: 'pinged',
      minutesSilent,
      graceMinutes,
      nextStageAt: new Date(lastCheckInTime + tFlagged * 60000),
      likelyDeadPhone,
      needsProxy,
      stageName: 'Pinged (In-person neighbour check requested)',
    };
  }

  return {
    status: 'flagged',
    minutesSilent,
    graceMinutes,
    nextStageAt: null,
    likelyDeadPhone,
    needsProxy,
    stageName: 'Flagged (Clustered & Ranked for Dispatch)',
  };
}
