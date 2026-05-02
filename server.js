'use strict';

require('dotenv').config();
const express = require('express');
const axios   = require('axios');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const ROKU_IP   = process.env.ROKU_IP   || '10.10.116.28';
const ROKU_BASE = `http://${ROKU_IP}:8060`;

// Input validation patterns
const VALID_KEY = /^[A-Za-z0-9_]+$/;   // Roku ECP key names
const VALID_ID  = /^\d+$/;              // Roku channel/app IDs
const MAX_TEXT  = 500;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ── Keypress ────────────────────────────────────────────────────
app.post('/api/keypress/:key', async (req, res) => {
  if (!VALID_KEY.test(req.params.key)) {
    return res.status(400).json({ error: 'Invalid key name' });
  }
  try {
    await axios.post(`${ROKU_BASE}/keypress/${req.params.key}`);
    res.json({ ok: true });
  } catch {
    res.status(502).json({ error: 'Failed to reach Roku' });
  }
});

// ── Text input (server handles Lit_ encoding per character) ─────
app.post('/api/text', async (req, res) => {
  const { text } = req.body;
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_TEXT) {
    return res.status(400).json({ error: 'Invalid text' });
  }
  try {
    for (const ch of text) {
      await axios.post(`${ROKU_BASE}/keypress/Lit_${encodeURIComponent(ch)}`);
    }
    res.json({ ok: true });
  } catch {
    res.status(502).json({ error: 'Failed to reach Roku' });
  }
});

// ── Installed apps (XML) ────────────────────────────────────────
app.get('/api/apps', async (req, res) => {
  try {
    const { data } = await axios.get(`${ROKU_BASE}/query/apps`);
    res.type('application/xml').send(data);
  } catch {
    res.status(502).json({ error: 'Failed to reach Roku' });
  }
});

// ── Active app (XML) ────────────────────────────────────────────
app.get('/api/active-app', async (req, res) => {
  try {
    const { data } = await axios.get(`${ROKU_BASE}/query/active-app`);
    res.type('application/xml').send(data);
  } catch {
    res.status(502).json({ error: 'Failed to reach Roku' });
  }
});

// ── Device info (XML) ───────────────────────────────────────────
app.get('/api/device-info', async (req, res) => {
  try {
    const { data } = await axios.get(`${ROKU_BASE}/query/device-info`);
    res.type('application/xml').send(data);
  } catch {
    res.status(502).json({ error: 'Failed to reach Roku' });
  }
});

// ── Launch app ──────────────────────────────────────────────────
app.post('/api/launch/:appId', async (req, res) => {
  if (!VALID_ID.test(req.params.appId)) {
    return res.status(400).json({ error: 'Invalid app ID' });
  }
  try {
    await axios.post(`${ROKU_BASE}/launch/${req.params.appId}`);
    res.json({ ok: true });
  } catch {
    res.status(502).json({ error: 'Failed to reach Roku' });
  }
});

// ── App icon (proxied + browser-cached) ─────────────────────────
app.get('/api/icon/:appId', async (req, res) => {
  if (!VALID_ID.test(req.params.appId)) {
    return res.status(400).end();
  }
  try {
    const { data, headers } = await axios.get(
      `${ROKU_BASE}/query/icon/${req.params.appId}`,
      { responseType: 'arraybuffer' }
    );
    res.set('Content-Type', headers['content-type'] || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(data));
  } catch {
    res.status(404).end();
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Roku Web Remote  →  http://0.0.0.0:${PORT}`);
  console.log(`Roku ECP target  →  ${ROKU_BASE}`);
});
