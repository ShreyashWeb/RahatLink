import http from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { setupSignaling } from './signaling';
import {
  initPersistence,
  handleYjsSyncConnection,
  hubDoc,
  householdsMap,
  tasksMap,
  accessLogArray,
  healthProfilesMap,
  settingsMap,
} from './hubStore';
import type { AccessLogEntry } from '@rahatlink/core';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4444;

app.use(cors());
app.use(express.json());

// Initialize binary file persistence
initPersistence();

app.get('/', (_req, res) => {
  res.json({
    app: 'RahatLink Hub',
    status: 'online',
    tagline: 'Other apps wait for an SOS. RahatLink notices who went silent.',
    stats: {
      households: householdsMap.size,
      tasks: tasksMap.size,
      accessLogs: accessLogArray.length,
      mode: settingsMap.get('disasterMode') ? 'DISASTER' : 'PEACETIME',
    },
    simulated: true,
  });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    port: PORT,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Settings REST endpoints
app.get('/api/settings', (_req, res) => {
  res.json(settingsMap.toJSON());
});

app.post('/api/settings', (req, res) => {
  const updates = req.body || {};
  for (const [key, val] of Object.entries(updates)) {
    settingsMap.set(key, val);
  }
  res.json({ success: true, settings: settingsMap.toJSON() });
});

// Simulated SMS Ingestion stub (Prompt 9)
app.post('/sms', (req, res) => {
  const { from, text } = req.body || {};
  res.status(202).json({
    received: true,
    from: from || 'unknown',
    text: text || '',
    note: 'SMS ingestion endpoint ready (Prompt 9)',
    simulated: true,
  });
});

// Health Briefing Unlock Stub (Prompt 2 & 8 plumbing)
app.post('/briefing/unlock', (req, res) => {
  const { taskId, volunteerId } = req.body || {};
  if (!taskId || !volunteerId) {
    return res.status(400).json({ error: 'taskId and volunteerId required' });
  }

  const task = tasksMap.get(taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Verification stub: task must be approved/assigned
  if (task.status !== 'approved' && task.status !== 'accepted') {
    return res.status(403).json({
      error: 'Access denied: Volunteer may only unlock briefing after coordinator approves and task is accepted.',
    });
  }

  // Audit view in access log
  const logEntry: AccessLogEntry = {
    id: `log-${Date.now()}`,
    at: new Date().toISOString(),
    actor: volunteerId,
    role: 'volunteer',
    householdId: task.householdIds[0] || 'unknown',
    field: 'healthProfile',
    action: 'view',
    reason: `Volunteer task briefing unlocked for task ${taskId}`,
  };
  accessLogArray.push([logEntry]);

  // Retrieve health profile from separate health store
  const primaryHouseholdId = task.householdIds[0];
  const profile = primaryHouseholdId ? healthProfilesMap.get(primaryHouseholdId) : null;

  return res.json({
    unlocked: true,
    taskId,
    volunteerId,
    expiresInSeconds: 21600, // 6h max expiry
    healthProfile: profile || {
      householdId: primaryHouseholdId,
      conditions: [],
      allergies: [],
      notes: 'No sensitive conditions on record',
      updatedAt: new Date().toISOString(),
    },
    simulated: true,
  });
});

// Break-glass emergency unlock stub (Prompt 8)
app.post('/briefing/break-glass', (req, res) => {
  const { taskId, actor, reason } = req.body || {};
  if (!taskId || !reason) {
    return res.status(400).json({ error: 'taskId and mandatory logged reason required for break-glass' });
  }

  const task = tasksMap.get(taskId);
  const householdId = task?.householdIds[0] || 'unknown';

  const logEntry: AccessLogEntry = {
    id: `log-bg-${Date.now()}`,
    at: new Date().toISOString(),
    actor: actor || 'coordinator',
    role: 'coordinator',
    householdId,
    field: 'healthProfile',
    action: 'break-glass',
    reason: String(reason),
  };
  accessLogArray.push([logEntry]);

  return res.json({
    breakGlass: true,
    taskId,
    loggedReason: reason,
    timestamp: logEntry.at,
  });
});

// Create HTTP server
const server = http.createServer(app);

// Setup WebSockets
const signalingWss = new WebSocketServer({ noServer: true });
const yjsWss = new WebSocketServer({ noServer: true });

setupSignaling(signalingWss);

yjsWss.on('connection', (ws) => {
  handleYjsSyncConnection(ws);
});

// Route upgrade requests
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (pathname === '/yjs' || pathname === '/sync') {
    yjsWss.handleUpgrade(request, socket, head, (ws) => {
      yjsWss.emit('connection', ws, request);
    });
  } else {
    // Default to y-webrtc signaling server (compatible with ws://<host>:4444 or /signaling)
    signalingWss.handleUpgrade(request, socket, head, (ws) => {
      signalingWss.emit('connection', ws, request);
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[RahatLink Hub] Running on http://localhost:${PORT}`);
  console.log(`[RahatLink Hub] y-webrtc signaling active on ws://0.0.0.0:${PORT} (/signaling)`);
  console.log(`[RahatLink Hub] Yjs Node peer sync active on ws://0.0.0.0:${PORT}/yjs`);
  console.log(`[RahatLink Hub] Zero cloud dependencies. Local network ready.`);
});
