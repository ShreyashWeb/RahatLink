import { describe, it, expect } from 'vitest';
import { haversine, dbscan, clusterFlaggedHouseholds, GeoPoint } from './cluster';
import { Household } from './types';

describe('Spatial Clustering Engine (packages/core/src/cluster.ts)', () => {
  it('calculates Haversine distance correctly in metres', () => {
    // Two points approx 111 metres apart (0.001 deg lat change)
    const p1 = { lat: 26.8467, lng: 80.9462 };
    const p2 = { lat: 26.8477, lng: 80.9462 };

    const distance = haversine(p1, p2);
    expect(distance).toBeGreaterThan(105);
    expect(distance).toBeLessThan(115);
  });

  it('correctly identifies clusters within eps 150m and identifies noise', () => {
    // 3 close points in Gomti Nagar (< 100m apart)
    const points: GeoPoint[] = [
      { id: 'h-1', lat: 26.8467, lng: 80.9462 },
      { id: 'h-2', lat: 26.8471, lng: 80.9465 }, // ~55m from h-1
      { id: 'h-3', lat: 26.8469, lng: 80.9463 }, // ~25m from h-1
      // 1 isolated point 800m away
      { id: 'h-outlier', lat: 26.854, lng: 80.954 },
    ];

    const result = dbscan(points, 150, 2);

    expect(result.clusters.length).toBe(1);
    expect(result.clusters[0].size).toBe(3);
    expect(result.clusters[0].memberIds).toContain('h-1');
    expect(result.clusters[0].memberIds).toContain('h-2');
    expect(result.clusters[0].memberIds).toContain('h-3');

    // The outlier is identified as noise (single silent household)
    expect(result.noiseIds).toEqual(['h-outlier']);
  });

  it('convenience clusterFlaggedHouseholds clusters only flagged or pinged households', () => {
    const households: Household[] = [
      {
        id: 'h-1',
        name: 'Household 1',
        lat: 26.8467,
        lng: 80.9462,
        address: 'St 1',
        contactPhone: '123',
        householdSize: 2,
        hasSmartphone: true,
        graceHours: 24,
        consent: { health: false },
        status: 'flagged',
      },
      {
        id: 'h-2',
        name: 'Household 2',
        lat: 26.847,
        lng: 80.9464,
        address: 'St 2',
        contactPhone: '123',
        householdSize: 2,
        hasSmartphone: true,
        graceHours: 24,
        consent: { health: false },
        status: 'pinged',
      },
      {
        id: 'h-3',
        name: 'Household 3 (OK - should be excluded)',
        lat: 26.8469,
        lng: 80.9463,
        address: 'St 3',
        contactPhone: '123',
        householdSize: 2,
        hasSmartphone: true,
        graceHours: 24,
        consent: { health: false },
        status: 'ok',
      },
    ];

    const result = clusterFlaggedHouseholds(households, 150, 2);

    expect(result.clusters.length).toBe(1);
    expect(result.clusters[0].size).toBe(2);
    expect(result.clusters[0].memberIds).toEqual(['h-1', 'h-2']);
  });
});
