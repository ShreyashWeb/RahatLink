import express from 'express';
import cors from 'cors';
import { DEFAULT_SETTINGS, Settings, Task, Household } from '@rahatlink/core';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4444;

app.use(cors());
app.use(express.json());

// In-memory hub configuration state
let currentSettings: Settings = { ...DEFAULT_SETTINGS };

app.get('/', (_req, res) => {
  res.json({
    app: 'RahatLink Hub',
    status: 'online',
    tagline: 'Other apps wait for an SOS. RahatLink notices who went silent.',
    mode: currentSettings.disasterMode ? 'DISASTER' : 'PEACETIME',
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

app.get('/api/settings', (_req, res) => {
  res.json(currentSettings);
});

app.post('/api/settings', (req, res) => {
  currentSettings = { ...currentSettings, ...req.body };
  res.json({ success: true, settings: currentSettings });
});

// Stubs for future prompts (SMS ingestion, briefing unlock, break-glass)
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[RahatLink Hub] Running on http://localhost:${PORT}`);
  console.log(`[RahatLink Hub] Local network port ${PORT} active. Zero cloud dependencies.`);
});
