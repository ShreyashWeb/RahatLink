import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebrtcProvider } from 'y-webrtc';
import { WebsocketProvider } from 'y-websocket';
import type {
  Household,
  HealthProfile,
  CheckIn,
  Report,
  Volunteer,
  Task,
  AccessLogEntry,
  FloodZone,
} from '@rahatlink/core';
import { DEFAULT_SETTINGS } from '@rahatlink/core';

// Main Shared CRDT Document
export const doc = new Y.Doc({ guid: 'rahatlink-main' });

// 1. Top-level maps/arrays
export const householdsMap = doc.getMap<Household>('households');
export const checkInsArray = doc.getArray<CheckIn>('checkIns');
export const reportsArray = doc.getArray<Report>('reports');
export const volunteersMap = doc.getMap<Volunteer>('volunteers');
export const tasksMap = doc.getMap<Task>('tasks');
export const accessLogArray = doc.getArray<AccessLogEntry>('accessLog');
export const settingsMap = doc.getMap<any>('settings');
export const floodZonesArray = doc.getArray<FloodZone>('floodZones');

// 2. Separate Health Document (Privacy Isolation)
// HealthProfile records live in a separate document. Volunteers never sync this directly.
export const healthDoc = new Y.Doc({ guid: 'rahatlink-health' });
export const healthProfilesMap = healthDoc.getMap<HealthProfile>('healthProfiles');

// Local IndexedDB persistence for offline-first resilience
export const indexeddbProvider = new IndexeddbPersistence('rahatlink-demo', doc);
export const healthIndexeddbProvider = new IndexeddbPersistence('rahatlink-health-local', healthDoc);

let isIdbLoaded = false;
indexeddbProvider.on('synced', () => {
  isIdbLoaded = true;
  notifySyncListeners();
});

// 3. Signaling configuration & Providers
const hubHost = typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost';
const defaultSignalingUrl = `ws://${hubHost}:4444`;
export const defaultHubWsUrl = `ws://${hubHost}:4444/yjs`;

export const signalingUrl =
  (typeof window !== 'undefined' && localStorage.getItem('rahatlink_signaling_url')) ||
  defaultSignalingUrl;

// y-webrtc peer-to-peer sync
export const webrtcProvider = new WebrtcProvider('rahatlink-demo', doc, {
  signaling: [signalingUrl],
});

// Optional direct WebSocket connection to the Node Hub
export let websocketProvider: WebsocketProvider | null = null;
try {
  websocketProvider = new WebsocketProvider(
    `ws://${hubHost}:4444`,
    'yjs',
    doc,
    { WebSocketPolyfill: typeof window !== 'undefined' ? window.WebSocket : undefined },
  );
} catch (err) {
  console.warn('[RahatLink] Direct hub websocket provider unavailable:', err);
}

// Sync Status Listeners
type SyncStateListener = (state: {
  status: 'offline' | 'syncing' | 'synced';
  peersCount: number;
  idbLoaded: boolean;
}) => void;

const syncListeners = new Set<SyncStateListener>();

export function subscribeSyncState(listener: SyncStateListener) {
  syncListeners.add(listener);
  listener(getSyncState());
  return () => {
    syncListeners.delete(listener);
  };
}

export function getSyncState() {
  // Count connected WebRTC peers
  const webrtcRoom = webrtcProvider.room;
  const webrtcPeers = webrtcRoom ? webrtcRoom.webrtcConns.size : 0;
  const wsConnected = Boolean(websocketProvider && websocketProvider.wsconnected);

  const totalPeers = webrtcPeers + (wsConnected ? 1 : 0);

  let status: 'offline' | 'syncing' | 'synced' = 'offline';
  if (totalPeers > 0 || webrtcProvider.connected) {
    status = 'synced';
  } else if (webrtcProvider.signalingConns.length > 0) {
    status = 'syncing';
  }

  return {
    status,
    peersCount: totalPeers,
    idbLoaded: isIdbLoaded,
  };
}

function notifySyncListeners() {
  const state = getSyncState();
  syncListeners.forEach((l) => l(state));
}

webrtcProvider.on('status', () => notifySyncListeners());
webrtcProvider.on('peers', () => notifySyncListeners());
if (websocketProvider) {
  websocketProvider.on('status', () => notifySyncListeners());
  websocketProvider.on('sync', () => notifySyncListeners());
}

// Initialize settings defaults if empty
doc.on('load', () => {
  if (settingsMap.size === 0) {
    for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
      settingsMap.set(key, val);
    }
  }
});
