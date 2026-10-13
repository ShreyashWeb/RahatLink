import type {
  Household,
  HealthProfile,
  Report,
  FloodZone,
  RiskTier,
  ScoreBreakdownItem,
  Task,
  Settings,
} from './types';
import { haversine } from './cluster';
import { CHECKIN_CADENCE_MINUTES } from './silence';

export interface ScoringContext {
  healthProfile?: HealthProfile | null;
  clusterSize?: number; // size of DBSCAN cluster (1 = isolated/noise)
  floodZones?: FloodZone[];
  reports?: Report[];
  now?: Date;
  settings: Settings;
}

export interface RiskScoreResult {
  score: number;
  tier: RiskTier;
  breakdown: ScoreBreakdownItem[];
}

/**
 * Calculates shortest distance in metres from a coordinate point to a polygon boundary/vertices.
 */
export function distanceToPolygon(
  point: { lat: number; lng: number },
  polygon: [number, number][],
): number {
  if (!polygon || polygon.length === 0) return Infinity;

  let minDistance = Infinity;
  for (const vertex of polygon) {
    const dist = haversine(point, { lat: vertex[0], lng: vertex[1] });
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance;
}

/**
 * Pure risk scoring formula with transparent, human-readable sentence breakdowns.
 *
 * Tiers:
 * - >= 70: HIGH
 * - 40 - 69: MEDIUM
 * - < 40: LOW
 */
export function scoreHousehold(
  h: Household,
  ctx: ScoringContext,
): RiskScoreResult {
  const {
    healthProfile,
    clusterSize = 1,
    floodZones = [],
    reports = [],
    now = new Date(),
    settings,
  } = ctx;

  const weights = settings.weights;
  const maxSilenceWeight = weights.silenceBeyondGrace ?? 25;
  const maxClusterWeight = weights.clusterSize ?? 20;
  const maxMedicalWeight = weights.medicalVulnerability ?? 25;
  const maxFloodWeight = weights.floodZoneDistance ?? 15;
  const maxBatteryWeight = weights.battery ?? 5;
  const maxReportsWeight = weights.corroboratingReports ?? 10;

  const breakdown: ScoreBreakdownItem[] = [];

  // 1. Silence Beyond Grace (up to maxSilenceWeight)
  let silencePoints = 0;
  let silenceSentence = 'Within grace window (+0)';

  if (h.lastCheckInAt) {
    const lastCheckInMs = new Date(h.lastCheckInAt).getTime();
    const elapsedMinutes = Math.max(0, (now.getTime() - lastCheckInMs) / 60000);

    const baseGraceMinutes = (h.graceHours || 24) * 60;
    const graceMultiplier = settings.disasterMode
      ? settings.disasterGraceFactor ?? 0.5
      : 1.0;
    const effectiveGraceMinutes = Math.round(baseGraceMinutes * graceMultiplier);
    const graceThresholdMinutes = CHECKIN_CADENCE_MINUTES + effectiveGraceMinutes;

    if (elapsedMinutes > graceThresholdMinutes) {
      const minutesPastGrace = elapsedMinutes - graceThresholdMinutes;
      const hoursPastGrace = Math.round((minutesPastGrace / 60) * 10) / 10;

      // Scaled: 12h past grace awards full points
      const ratio = Math.min(1.0, hoursPastGrace / 12);
      silencePoints = Math.round(ratio * maxSilenceWeight);
      silenceSentence = `Silent ${hoursPastGrace}h beyond grace (+${silencePoints})`;
    }
  } else {
    silencePoints = maxSilenceWeight;
    silenceSentence = `No recorded check-in on file (+${silencePoints})`;
  }

  breakdown.push({
    factor: 'silenceBeyondGrace',
    points: silencePoints,
    description: silenceSentence,
  });

  // 2. Cluster Size (DBSCAN) (up to maxClusterWeight)
  let clusterPoints = 0;
  let clusterSentence = 'Isolated silent household (+0)';

  if (clusterSize >= 2) {
    // 2 members: 50%, 3 members: 75%, 4+ members: 100%
    const ratio = Math.min(1.0, (clusterSize - 1) / 3);
    clusterPoints = Math.round(ratio * maxClusterWeight);
    clusterSentence = `${clusterSize - 1} nearby neighbours also silent (+${clusterPoints})`;
  }

  breakdown.push({
    factor: 'clusterSize',
    points: clusterPoints,
    description: clusterSentence,
  });

  // 3. Medical Vulnerability (strictly consent-gated, up to maxMedicalWeight)
  let medicalPoints = 0;
  let medicalSentence = 'No health profile consented (+0)';

  if (h.consent && h.consent.health && healthProfile && healthProfile.conditions) {
    const conditions = healthProfile.conditions.map((c) => c.toLowerCase());
    const highRiskConditions = [
      'insulin-dependent',
      'insulin',
      'oxygen',
      'limited-mobility',
      'bedridden',
    ];

    const hasHighRisk = conditions.some((c) =>
      highRiskConditions.some((hr) => c.includes(hr)),
    );

    if (hasHighRisk) {
      medicalPoints = maxMedicalWeight;
      const matched = conditions.filter((c) =>
        highRiskConditions.some((hr) => c.includes(hr)),
      );
      medicalSentence = `Consented profile: ${matched.join(', ')} (+${medicalPoints})`;
    } else if (conditions.length > 0) {
      medicalPoints = Math.round(maxMedicalWeight * 0.6);
      medicalSentence = `Consented profile: ${conditions.join(', ')} (+${medicalPoints})`;
    } else {
      medicalSentence = 'Consented profile: no high-risk conditions (+0)';
    }
  } else if (!h.consent?.health) {
    medicalSentence = 'Health consent not granted (medical points suppressed) (+0)';
  }

  breakdown.push({
    factor: 'medicalVulnerability',
    points: medicalPoints,
    description: medicalSentence,
  });

  // 4. Proximity to Flood Zone (up to maxFloodWeight)
  let floodPoints = 0;
  let floodSentence = 'Over 500m from nearest flood zone (+0)';

  if (floodZones.length > 0) {
    let closestZoneName = '';
    let minDistance = Infinity;

    for (const fz of floodZones) {
      const dist = distanceToPolygon(h, fz.polygon);
      if (dist < minDistance) {
        minDistance = dist;
        closestZoneName = fz.name;
      }
    }

    if (minDistance <= 100) {
      floodPoints = maxFloodWeight;
      floodSentence = `${Math.round(minDistance)}m from ${closestZoneName} (+${floodPoints})`;
    } else if (minDistance <= 250) {
      floodPoints = Math.round(maxFloodWeight * 0.67);
      floodSentence = `${Math.round(minDistance)}m from ${closestZoneName} (+${floodPoints})`;
    } else if (minDistance <= 500) {
      floodPoints = Math.round(maxFloodWeight * 0.33);
      floodSentence = `${Math.round(minDistance)}m from ${closestZoneName} (+${floodPoints})`;
    } else {
      floodSentence = `${Math.round(minDistance)}m from ${closestZoneName} (+0)`;
    }
  }

  breakdown.push({
    factor: 'floodZoneDistance',
    points: floodPoints,
    description: floodSentence,
  });

  // 5. Battery Level (up to maxBatteryWeight)
  let batteryPoints = 0;
  let batterySentence = `Battery adequate at ${h.lastBattery ?? 80}% (+0)`;

  if (h.lastBattery !== undefined && h.lastBattery <= 5) {
    batteryPoints = maxBatteryWeight;
    batterySentence = `Critical battery ${h.lastBattery}% at last check-in (+${batteryPoints})`;
  }

  breakdown.push({
    factor: 'battery',
    points: batteryPoints,
    description: batterySentence,
  });

  // 6. Corroborating Reports within 200m in last 6h (up to maxReportsWeight)
  let reportPoints = 0;
  let reportSentence = 'No corroborating reports nearby (+0)';

  const sixHoursAgoMs = now.getTime() - 6 * 3600 * 1000;
  const nearbyReports = reports.filter((r) => {
    const reportTime = new Date(r.at).getTime();
    if (reportTime < sixHoursAgoMs) return false;
    if (r.parsed?.matchedHouseholdId === h.id) return true;
    if (r.lat && r.lng) {
      return haversine(h, { lat: r.lat, lng: r.lng }) <= 200;
    }
    return false;
  });

  if (nearbyReports.length > 0) {
    reportPoints = Math.min(maxReportsWeight, nearbyReports.length * 5);
    reportSentence = `${nearbyReports.length} corroborating distress report(s) within 200m in last 6h (+${reportPoints})`;
  }

  breakdown.push({
    factor: 'corroboratingReports',
    points: reportPoints,
    description: reportSentence,
  });

  // Sum total score, capped at 100
  const rawScore = breakdown.reduce((sum, item) => sum + item.points, 0);
  const score = Math.min(100, Math.max(0, rawScore));

  let tier: RiskTier = 'LOW';
  if (score >= 70) {
    tier = 'HIGH';
  } else if (score >= 40) {
    tier = 'MEDIUM';
  } else {
    tier = 'LOW';
  }

  return { score, tier, breakdown };
}

/**
 * Creates a suggested dispatch task based on computed risk score
 */
export function createSuggestedTask(
  householdIds: string[],
  scoreResult: RiskScoreResult,
): Task {
  return {
    id: `task-${Date.now().toString().slice(-5)}`,
    householdIds,
    riskTier: scoreResult.tier,
    score: scoreResult.score,
    breakdown: scoreResult.breakdown,
    status: 'suggested',
    createdAt: new Date().toISOString(),
  };
}
