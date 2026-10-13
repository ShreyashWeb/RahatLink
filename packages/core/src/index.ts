export * from './types';
export * from './silence';

export const DEFAULT_RISK_WEIGHTS = {
  silenceBeyondGrace: 25,
  clusterSize: 20,
  medicalVulnerability: 25,
  floodZoneDistance: 15,
  battery: 5,
  corroboratingReports: 10,
};

export const DEFAULT_SETTINGS = {
  disasterMode: false,
  disasterGraceFactor: 0.5,
  weights: DEFAULT_RISK_WEIGHTS,
};
