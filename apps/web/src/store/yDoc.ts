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
  AppNotification,
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
export const notificationsArray = doc.getArray<AppNotification>('notifications');
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

// 3. Signaling configuration & Providers (Protocol & Environment Aware)
export function getHubConnectionConfig() {
  if (typeof window === 'undefined') {
    return {
      signalingUrl: 'ws://localhost:4444',
      wsUrl: 'ws://localhost:4444',
      httpUrl: 'http://localhost:4444',
    };
  }

  const isHttps = window.location.protocol === 'https:';
  const wsProto = isHttps ? 'wss:' : 'ws:';
  const httpProto = isHttps ? 'https:' : 'http:';
  const hostname = window.location.hostname || 'localhost';
  const isViteDev = window.location.port === '5173' || window.location.port === '3000';

  const hostWithPort = isViteDev ? `${hostname}:4444` : window.location.host;

  const defaultSignaling = `${wsProto}//${hostWithPort}`;
  const customSignaling = localStorage.getItem('rahatlink_signaling_url');

  return {
    signalingUrl: customSignaling || defaultSignaling,
    wsUrl: `${wsProto}//${hostWithPort}`,
    httpUrl: isViteDev ? `http://${hostname}:4444` : `${httpProto}//${window.location.host}`,
  };
}

export function getHubApiUrl(endpointPath: string): string {
  if (typeof window === 'undefined') return `http://localhost:4444${endpointPath}`;
  const isViteDev = window.location.port === '5173' || window.location.port === '3000';
  if (isViteDev) {
    const hostname = window.location.hostname || 'localhost';
    return `http://${hostname}:4444${endpointPath}`;
  }
  return endpointPath;
}

const connectionConfig = getHubConnectionConfig();
export const defaultSignalingUrl = connectionConfig.signalingUrl;
export const defaultHubWsUrl = `${connectionConfig.wsUrl}/yjs`;
export const signalingUrl = connectionConfig.signalingUrl;

// y-webrtc peer-to-peer sync
export const webrtcProvider = new WebrtcProvider('rahatlink-demo', doc, {
  signaling: [signalingUrl],
});

// Optional direct WebSocket connection to the Node Hub
export let websocketProvider: WebsocketProvider | null = null;
try {
  websocketProvider = new WebsocketProvider(
    connectionConfig.wsUrl,
    'yjs',
    doc,
    { WebSocketPolyfill: typeof window !== 'undefined' ? window.WebSocket : undefined },
  );
} catch (err) {
  console.warn('[RahatLink] Direct hub websocket provider unavailable:', err);
}

// Cached sync state to ensure stable reference for useSyncExternalStore
export interface SyncState {
  status: 'offline' | 'syncing' | 'synced';
  peersCount: number;
  idbLoaded: boolean;
  lastSyncedAt: Date | null;
}

let lastSuccessfulSyncTime: Date | null = null;

let cachedSyncState: SyncState = {
  status: 'offline',
  peersCount: 0,
  idbLoaded: false,
  lastSyncedAt: null,
};

type SyncStateListener = (state: SyncState) => void;
const syncListeners = new Set<SyncStateListener>();

export function subscribeSyncState(listener: SyncStateListener) {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

export function getSyncState(): SyncState {
  // Count connected WebRTC peers
  const webrtcRoom = webrtcProvider.room;
  const webrtcPeers = webrtcRoom ? webrtcRoom.webrtcConns.size : 0;
  const wsConnected = Boolean(websocketProvider && websocketProvider.wsconnected);

  const totalPeers = webrtcPeers + (wsConnected ? 1 : 0);

  let status: 'offline' | 'syncing' | 'synced' = 'offline';
  if (totalPeers > 0 || webrtcProvider.connected) {
    status = 'synced';
    if (!lastSuccessfulSyncTime) {
      lastSuccessfulSyncTime = new Date();
    }
  } else if (webrtcProvider.signalingConns.length > 0) {
    status = 'syncing';
  }

  if (
    cachedSyncState.status !== status ||
    cachedSyncState.peersCount !== totalPeers ||
    cachedSyncState.idbLoaded !== isIdbLoaded ||
    cachedSyncState.lastSyncedAt !== lastSuccessfulSyncTime
  ) {
    cachedSyncState = {
      status,
      peersCount: totalPeers,
      idbLoaded: isIdbLoaded,
      lastSyncedAt: lastSuccessfulSyncTime,
    };
  }

  return cachedSyncState;
}

function notifySyncListeners() {
  const webrtcRoom = webrtcProvider.room;
  const webrtcPeers = webrtcRoom ? webrtcRoom.webrtcConns.size : 0;
  const wsConnected = Boolean(websocketProvider && websocketProvider.wsconnected);
  if (webrtcPeers > 0 || wsConnected || webrtcProvider.connected) {
    lastSuccessfulSyncTime = new Date();
  }
  getSyncState();
  syncListeners.forEach((l) => l(cachedSyncState));
}

webrtcProvider.on('status', () => notifySyncListeners());
webrtcProvider.on('peers', () => notifySyncListeners());
doc.on('update', () => {
  lastSuccessfulSyncTime = new Date();
  notifySyncListeners();
});

if (websocketProvider) {
  websocketProvider.on('status', () => notifySyncListeners());
  websocketProvider.on('sync', (isSynced: boolean) => {
    if (isSynced) {
      lastSuccessfulSyncTime = new Date();
    }
    notifySyncListeners();
  });
}

// Initialize settings defaults if empty
doc.on('load', () => {
  if (settingsMap.size === 0) {
    for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
      settingsMap.set(key, val);
    }
  }
});
