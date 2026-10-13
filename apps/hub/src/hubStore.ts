import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import fs from 'fs';
import path from 'path';
import { WebSocket } from 'ws';
import type {
  Household,
  HealthProfile,
  CheckIn,
  Report,
  Volunteer,
  Task,
  AccessLogEntry,
  FloodZone,
  Settings,
} from '@rahatlink/core';
import { DEFAULT_SETTINGS } from '@rahatlink/core';

const messageSync = 0;
const messageAwareness = 1;

// Paths for binary persistence snapshots
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_SNAPSHOT_FILE = path.join(DATA_DIR, 'hub-store.bin');
const HEALTH_SNAPSHOT_FILE = path.join(DATA_DIR, 'hub-health.bin');

// Hub Master Documents
export const hubDoc = new Y.Doc({ guid: 'rahatlink-main' });
export const hubHealthDoc = new Y.Doc({ guid: 'rahatlink-health' });

// Awareness protocols
export const hubAwareness = new awarenessProtocol.Awareness(hubDoc);

// Top-level collections on main doc
export const householdsMap = hubDoc.getMap<Household>('households');
export const checkInsArray = hubDoc.getArray<CheckIn>('checkIns');
export const reportsArray = hubDoc.getArray<Report>('reports');
export const volunteersMap = hubDoc.getMap<Volunteer>('volunteers');
export const tasksMap = hubDoc.getMap<Task>('tasks');
export const accessLogArray = hubDoc.getArray<AccessLogEntry>('accessLog');
export const settingsMap = hubDoc.getMap<any>('settings');
export const floodZonesArray = hubDoc.getArray<FloodZone>('floodZones');

// Top-level collections on separate health doc
export const healthProfilesMap = hubHealthDoc.getMap<HealthProfile>('healthProfiles');

// Connected sync WebSocket clients
const syncClients = new Set<WebSocket>();
let isDirty = false;

// Initialize default settings if not populated
if (settingsMap.size === 0) {
  for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
    settingsMap.set(key, val);
  }
}

// Ensure persistence directory exists and load initial snapshot
export function initPersistence() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(STORE_SNAPSHOT_FILE)) {
    try {
      const buffer = fs.readFileSync(STORE_SNAPSHOT_FILE);
      Y.applyUpdate(hubDoc, new Uint8Array(buffer));
      console.log(`[RahatLink Hub] Loaded main doc snapshot (${buffer.byteLength} bytes)`);
    } catch (err) {
      console.error('[RahatLink Hub] Error loading main doc snapshot:', err);
    }
  }

  if (fs.existsSync(HEALTH_SNAPSHOT_FILE)) {
    try {
      const buffer = fs.readFileSync(HEALTH_SNAPSHOT_FILE);
      Y.applyUpdate(hubHealthDoc, new Uint8Array(buffer));
      console.log(`[RahatLink Hub] Loaded health doc snapshot (${buffer.byteLength} bytes)`);
    } catch (err) {
      console.error('[RahatLink Hub] Error loading health doc snapshot:', err);
    }
  }

  // Periodic snapshot saving every 10 seconds
  setInterval(() => {
    if (isDirty) {
      try {
        const update = Y.encodeStateAsUpdate(hubDoc);
        fs.writeFileSync(STORE_SNAPSHOT_FILE, Buffer.from(update));

        const healthUpdate = Y.encodeStateAsUpdate(hubHealthDoc);
        fs.writeFileSync(HEALTH_SNAPSHOT_FILE, Buffer.from(healthUpdate));

        isDirty = false;
        console.log(`[RahatLink Hub] Saved store snapshots to disk (${update.byteLength} bytes)`);
      } catch (err) {
        console.error('[RahatLink Hub] Failed to save store snapshot:', err);
      }
    }
  }, 10000);
}

// Track local doc mutations to trigger periodic persistence and broadcast updates
hubDoc.on('update', (update: Uint8Array, origin: any) => {
  isDirty = true;
  // Broadcast update to all connected Yjs websocket clients
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeUpdate(encoder, update);
  const message = encoding.toUint8Array(encoder);

  for (const client of syncClients) {
    if (client !== origin && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
});

hubHealthDoc.on('update', () => {
  isDirty = true;
});

/**
 * Handles incoming Yjs sync WebSocket connections from browser peers
 */
export function handleYjsSyncConnection(conn: WebSocket) {
  syncClients.add(conn);

  // Send SyncStep1 to new client
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, hubDoc);
  conn.send(encoding.toUint8Array(encoder));

  // Send current awareness states
  const awarenessStates = hubAwareness.getStates();
  if (awarenessStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, messageAwareness);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(
        hubAwareness,
        Array.from(awarenessStates.keys()),
      ),
    );
    conn.send(encoding.toUint8Array(awarenessEncoder));
  }

  conn.on('message', (data: any) => {
    try {
      const buffer = data instanceof Buffer ? data : Buffer.from(data);
      const decoder = decoding.createDecoder(new Uint8Array(buffer));
      const messageType = decoding.readVarUint(decoder);

      if (messageType === messageSync) {
        const replyEncoder = encoding.createEncoder();
        encoding.writeVarUint(replyEncoder, messageSync);
        syncProtocol.readSyncMessage(decoder, replyEncoder, hubDoc, conn);
        if (encoding.length(replyEncoder) > 1) {
          conn.send(encoding.toUint8Array(replyEncoder));
        }
      } else if (messageType === messageAwareness) {
        awarenessProtocol.applyAwarenessUpdate(
          hubAwareness,
          decoding.readVarUint8Array(decoder),
          conn,
        );
      }
    } catch (err) {
      console.error('[RahatLink Hub] Error handling Yjs message:', err);
    }
  });

  conn.on('close', () => {
    syncClients.delete(conn);
  });
}
