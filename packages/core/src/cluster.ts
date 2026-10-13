import type { Household } from './types';

export interface GeoPoint {
  id: string;
  lat: number;
  lng: number;
}

export interface Cluster {
  id: string;
  memberIds: string[];
  centroid: { lat: number; lng: number };
  size: number;
}

export interface ClusteringResult {
  clusters: Cluster[];
  noiseIds: string[];
}

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates great-circle distance between two coordinates in metres using the Haversine formula.
 */
export function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;

  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLng = Math.sin(dLng / 2);

  const aVal =
    sinHalfLat * sinHalfLat +
    Math.cos(lat1) * Math.cos(lat2) * sinHalfLng * sinHalfLng;

  const cVal = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return EARTH_RADIUS_METERS * cVal;
}

/**
 * DBSCAN Spatial Clustering implementation (Pure TypeScript, Zero Cloud Dependencies)
 *
 * @param points Array of geographic points with id, lat, lng
 * @param epsMeters Maximum radius in metres to consider points as neighbours (default: 150m)
 * @param minPts Minimum points required to form a dense core cluster (default: 2)
 */
export function dbscan(
  points: GeoPoint[],
  epsMeters: number = 150,
  minPts: number = 2,
): ClusteringResult {
  const n = points.length;
  const visited = new Set<string>();
  const pointClusterMap = new Map<string, number>(); // pointId -> clusterIndex, -1 for noise
  let currentCluster = 0;

  // Helper to find all neighbours within eps distance
  const getNeighbors = (pointIndex: number): number[] => {
    const neighbors: number[] = [];
    const p = points[pointIndex];
    for (let i = 0; i < n; i++) {
      if (haversine(p, points[i]) <= epsMeters) {
        neighbors.push(i);
      }
    }
    return neighbors;
  };

  for (let i = 0; i < n; i++) {
    const p = points[i];
    if (visited.has(p.id)) continue;
    visited.add(p.id);

    const neighbors = getNeighbors(i);

    if (neighbors.length < minPts) {
      // Mark as noise for now (may become border point of another cluster later)
      pointClusterMap.set(p.id, -1);
    } else {
      // Start a new cluster
      const clusterIdx = currentCluster++;
      pointClusterMap.set(p.id, clusterIdx);

      // Expand cluster queue
      const queue = [...neighbors];
      let qIdx = 0;

      while (qIdx < queue.length) {
        const neighborIdx = queue[qIdx++];
        const neighbor = points[neighborIdx];

        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          const neighborNeighbors = getNeighbors(neighborIdx);
          if (neighborNeighbors.length >= minPts) {
            // Add density-connected points to queue
            for (const nn of neighborNeighbors) {
              if (!queue.includes(nn)) {
                queue.push(nn);
              }
            }
          }
        }

        // If not assigned to any cluster (or was previously marked as noise), assign to this cluster
        if (!pointClusterMap.has(neighbor.id) || pointClusterMap.get(neighbor.id) === -1) {
          pointClusterMap.set(neighbor.id, clusterIdx);
        }
      }
    }
  }

  // Aggregate results by cluster index
  const clusterMembersMap = new Map<number, string[]>();
  const noiseIds: string[] = [];

  for (const p of points) {
    const cIdx = pointClusterMap.get(p.id) ?? -1;
    if (cIdx === -1) {
      noiseIds.push(p.id);
    } else {
      let members = clusterMembersMap.get(cIdx);
      if (!members) {
        members = [];
        clusterMembersMap.set(cIdx, members);
      }
      members.push(p.id);
    }
  }

  // Compute centroids for each cluster
  const clusters: Cluster[] = [];
  let clusterNumber = 1;

  for (const [, memberIds] of clusterMembersMap.entries()) {
    const memberPoints = points.filter((p) => memberIds.includes(p.id));
    const avgLat =
      memberPoints.reduce((sum, p) => sum + p.lat, 0) / memberPoints.length;
    const avgLng =
      memberPoints.reduce((sum, p) => sum + p.lng, 0) / memberPoints.length;

    clusters.push({
      id: `cluster-${clusterNumber++}`,
      memberIds,
      centroid: {
        lat: Number(avgLat.toFixed(6)),
        lng: Number(avgLng.toFixed(6)),
      },
      size: memberIds.length,
    });
  }

  // Sort clusters descending by size
  clusters.sort((a, b) => b.size - a.size);

  return { clusters, noiseIds };
}

/**
 * Convenience method to cluster silent households (status 'flagged' or 'pinged')
 */
export function clusterFlaggedHouseholds(
  households: Household[],
  epsMeters: number = 150,
  minPts: number = 2,
): ClusteringResult {
  const silentPoints: GeoPoint[] = households
    .filter((h) => h.status === 'flagged' || h.status === 'pinged')
    .map((h) => ({ id: h.id, lat: h.lat, lng: h.lng }));

  return dbscan(silentPoints, epsMeters, minPts);
}
