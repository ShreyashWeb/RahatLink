import http from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { setupSignaling } from './signaling';
import {
  initPersistence,
  handleYjsSyncConnection,
  evaluateAllHouseholds,
  hubDoc,
  householdsMap,
  tasksMap,
  reportsArray,
  accessLogArray,
  notificationsArray,
  healthProfilesMap,
  settingsMap,
} from './hubStore';
import type { AccessLogEntry } from '@rahatlink/core';
import { createReportFromSms } from '@rahatlink/core';

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

// Trigger Silence Engine evaluation manually or with virtual simulated timestamp
app.post('/api/silence/evaluate', (req, res) => {
  const { simulatedTimestamp } = req.body || {};
  const evalDate = simulatedTimestamp ? new Date(simulatedTimestamp) : new Date();
  evaluateAllHouseholds(evalDate);
  res.json({
    evaluated: true,
    timestamp: evalDate.toISOString(),
    householdsCount: householdsMap.size,
    notificationsCount: notificationsArray.length,
  });
});

// Simulated SMS Ingestion Gateway (Rule-based Hinglish + English parser)
app.post('/sms', (req, res) => {
  const { from, text } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'Text content required' });
  }

  const households = Array.from(householdsMap.values());
  const report = createReportFromSms(from || 'unknown', String(text).trim(), households);

  // Push into reportsArray on hub doc (broadcasts to connected peers)
  reportsArray.push([report]);

  // If a household was matched, log notification
  if (report.parsed?.matchedHouseholdId) {
    const matchedH = householdsMap.get(report.parsed.matchedHouseholdId);
    if (matchedH) {
      notificationsArray.push([
        {
          id: `notif-sms-${Date.now()}`,
          householdId: matchedH.id,
          householdName: matchedH.name,
          type: 'flagged',
          message: `SMS distress report received from ${from || 'resident'} matching ${matchedH.name} (${report.parsed.urgency} urgency): "${text}"`,
          at: new Date().toISOString(),
        },
      ]);
    }
  }

  return res.status(201).json({
    success: true,
    report,
    matchedHouseholdId: report.parsed?.matchedHouseholdId,
    confidence: report.parsed?.confidence,
    urgency: report.parsed?.urgency,
    needs: report.parsed?.needs,
    peopleCount: report.parsed?.peopleCount,
    locationHint: report.parsed?.locationHint,
    corroborating: Boolean(report.parsed?.matchedHouseholdId),
    simulated: true,
  });
});

// Health Briefing Unlock Endpoint (DPDP Act Compliance)
app.post('/briefing/unlock', (req, res) => {
  const { taskId, volunteerId } = req.body || {};
  if (!taskId || !volunteerId) {
    return res.status(400).json({ error: 'taskId and volunteerId required' });
  }

  const task = tasksMap.get(taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Check 1: Must be assigned to this volunteer
  if (task.volunteerId !== volunteerId) {
    return res.status(403).json({
      error: `Access denied: Task is assigned to ${task.volunteerId || 'no volunteer'}, not ${volunteerId}.`,
    });
  }

  // Check 2: Task must be active ('approved' or 'accepted'), NOT 'resolved' or 'cancelled'
  if (task.status === 'resolved' || task.status === 'cancelled') {
    return res.status(403).json({
      error: `Access expired: Task status is ${task.status}. Medical briefing access has been revoked.`,
    });
  }

  if (task.status !== 'approved' && task.status !== 'accepted') {
    return res.status(403).json({
      error: `Access denied: Task status is ${task.status}. Requires coordinator approval before unlock.`,
    });
  }

  // Check 3: Check resident health consent
  const primaryHouseholdId = task.householdIds[0];
  const household = householdsMap.get(primaryHouseholdId);
  const hasConsent = household?.consent?.health === true;

  // Audit view in access log
  const logEntry: AccessLogEntry = {
    id: `log-${Date.now()}`,
    at: new Date().toISOString(),
    actor: volunteerId,
    role: 'volunteer',
    householdId: primaryHouseholdId || 'unknown',
    field: hasConsent ? 'healthProfile' : 'locationOnly',
    action: 'view',
    reason: `Volunteer task briefing unlocked for task ${taskId}`,
  };
  accessLogArray.push([logEntry]);

  // Retrieve health profile from separate health store
  const profile = hasConsent && primaryHouseholdId ? healthProfilesMap.get(primaryHouseholdId) : null;

  return res.json({
    unlocked: true,
    taskId,
    volunteerId,
    unlockedAt: logEntry.at,
    expiresInSeconds: 21600, // 6h max expiry
    household: {
      id: household?.id,
      name: household?.name,
      address: household?.address,
      floor: household?.floor,
      contactPhone: household?.contactPhone,
    },
    healthProfile: profile || {
      householdId: primaryHouseholdId,
      conditions: [],
      allergies: [],
      notes: hasConsent
        ? 'No sensitive conditions on record'
        : 'Health consent not granted. Medical details suppressed.',
      updatedAt: new Date().toISOString(),
    },
    disclaimer: 'Self-reported by the resident. Not medical advice.',
    simulated: true,
  });
});

// Break-glass emergency unlock endpoint (Hard Rule 3 & 5)
app.post('/briefing/break-glass', (req, res) => {
  const { taskId, actor, reason } = req.body || {};
  if (!taskId || !reason || !String(reason).trim()) {
    return res.status(400).json({ error: 'taskId and mandatory logged reason required for break-glass' });
  }

  const task = tasksMap.get(taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const primaryHouseholdId = task.householdIds[0];
  const household = householdsMap.get(primaryHouseholdId);
  const hasConsent = household?.consent?.health === true;

  const logEntry: AccessLogEntry = {
    id: `log-bg-${Date.now()}`,
    at: new Date().toISOString(),
    actor: actor || 'coordinator',
    role: 'coordinator',
    householdId: primaryHouseholdId || 'unknown',
    field: hasConsent ? 'healthProfile' : 'locationOnly (no consent)',
    action: 'break-glass',
    reason: String(reason).trim(),
  };
  accessLogArray.push([logEntry]);

  const profile = hasConsent && primaryHouseholdId ? healthProfilesMap.get(primaryHouseholdId) : null;

  return res.json({
    breakGlass: true,
    taskId,
    hasConsent,
    loggedReason: String(reason).trim(),
    timestamp: logEntry.at,
    household: {
      id: household?.id,
      name: household?.name,
      address: household?.address,
      floor: household?.floor,
      contactPhone: household?.contactPhone,
    },
    healthProfile: profile || {
      householdId: primaryHouseholdId,
      conditions: [],
      allergies: [],
      notes: hasConsent
        ? 'No sensitive conditions on record'
        : 'Resident withheld health consent. Location released for life rescue only.',
    },
    disclaimer: 'Self-reported by the resident. Not medical advice.',
    simulated: true,
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
