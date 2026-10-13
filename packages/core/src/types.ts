/**
 * RahatLink Core Data Model
 * Offline-first neighbourhood safety & proactive silence detection.
 */

export type HouseholdStatus =
  | 'ok'
  | 'due'
  | 'grace'
  | 'reminded'
  | 'pinged'
  | 'flagged'
  | 'seenSafe';

export interface HouseholdConsent {
  health: boolean;
  grantedAt?: string;
}

export interface Household {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  floor?: number | string;
  contactPhone: string;
  householdSize: number;
  hasSmartphone: boolean;
  graceHours: number;
  lastCheckInAt?: string;
  lastBattery?: number;
  proxyNeighbourId?: string;
  consent: HouseholdConsent;
  status: HouseholdStatus;
}

export type HealthCondition =
  | 'diabetes'
  | 'asthma'
  | 'insulin-dependent'
  | 'limited-mobility'
  | string;

export interface HealthProfile {
  householdId: string;
  conditions: HealthCondition[];
  allergies: string[];
  medications?: string;
  notes?: string;
  updatedAt: string;
}

export type CheckInBy = 'self' | 'neighbour';

export interface CheckIn {
  id: string;
  householdId: string;
  at: string;
  by: CheckInBy;
  batteryPct?: number;
}

export type ReportSource = 'sms' | 'app';
export type RiskTier = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ParsedReport {
  type?: string;
  urgency?: RiskTier;
  needs?: string[];
  matchedHouseholdId?: string;
  peopleCount?: number;
  locationHint?: string;
  confidence?: number;
  explanation?: string;
}

export type ReportStatus = 'pending' | 'linked' | 'task_created' | 'ignored';

export interface Report {
  id: string;
  at: string;
  from?: string;
  lat?: number;
  lng?: number;
  text: string;
  source: ReportSource;
  status?: ReportStatus;
  parsed?: ParsedReport;
}

export interface Volunteer {
  id: string;
  name: string;
  skills: string[]; // e.g. 'first-aid', 'boat', 'medical'
  equipment: string[];
  lat: number;
  lng: number;
  available: boolean;
}

export type TaskStatus =
  | 'suggested'
  | 'approved'
  | 'accepted'
  | 'resolved'
  | 'cancelled'
  | 'overridden';

export interface ScoreBreakdownItem {
  factor: string;
  points: number;
  description: string;
}

export interface Task {
  id: string;
  householdIds: string[];
  riskTier: RiskTier;
  score: number;
  breakdown: ScoreBreakdownItem[] | Record<string, number | string>;
  status: TaskStatus;
  volunteerId?: string;
  approvedBy?: string;
  overrideReason?: string;
  notes?: string;
  createdAt: string;
  resolvedAt?: string;
}

export type AccessRole = 'coordinator' | 'volunteer' | 'resident' | 'neighbour' | string;
export type AccessAction = 'view' | 'break-glass' | 'delete-health-profile' | 'export-data' | string;

export interface AccessLogEntry {
  id: string;
  at: string;
  actor: string;
  role: AccessRole;
  householdId: string;
  field: string;
  action: AccessAction;
  reason?: string;
}

export type Coordinate = [number, number]; // [lat, lng]

export interface FloodZone {
  id: string;
  name: string;
  polygon: Coordinate[];
}

export interface RiskWeights {
  silenceBeyondGrace: number;
  clusterSize: number;
  medicalVulnerability: number;
  floodZoneDistance: number;
  battery: number;
  corroboratingReports: number;
  [key: string]: number;
}

export interface AppNotification {
  id: string;
  householdId: string;
  householdName: string;
  type: 'reminded' | 'pinged' | 'flagged' | 'seenSafe';
  message: string;
  at: string;
}

export interface Settings {
  disasterMode: boolean;
  disasterGraceFactor: number;
  weights: RiskWeights;
  clockSpeedMultiplier?: number;
  clockOffsetMs?: number;
}
