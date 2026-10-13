export * from './types';
export * from './silence';
export * from './cluster';
export * from './risk';
export * from './match';
export * from './privacy';

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
