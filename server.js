'use strict';

require('dotenv').config();
const express = require('express');
const axios   = require('axios');
const path    = require('path');
const net     = require('net');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const app  = express();
const PORT = process.env.PORT || 3000;
const ROKU_IP   = process.env.ROKU_IP   || '10.10.116.28';
const ROKU_BASE = `http://${ROKU_IP}:8060`;

const SHIELD_IP   = process.env.SHIELD_IP   || '10.10.176.129';
const SHIELD_PORT = process.env.SHIELD_PORT || 5555;

const PIONEER_IP   = process.env.PIONEER_IP   || '10.10.48.10';
const PIONEER_PORT = process.env.PIONEER_PORT || 8102;

// Input validation patterns
const VALID_KEY = /^[A-Za-z0-9_]+$/;   // Roku ECP key names
const VALID_ID  = /^\d+$/;              // Roku channel/app IDs
const VALID_KEYCODE = /^\d+$/;          // Android keyevent codes
const MAX_TEXT  = 500;

// Pioneer eISCP command helper with proper packet header
function sendPioneerCommand(cmd) {
  return new Promise((resolve, reject) => {
    try {
      // Build eISCP packet with proper header
      const data = Buffer.from(cmd + '\r');
      const header = Buffer.alloc(16);
      header.write('ISCP', 0, 'ascii');
      header.writeUInt32BE(16, 4);           // header size
      header.writeUInt32BE(data.length, 8); // data size
      header.writeUInt8(1, 12);              // version
      // bytes 13-15 are reserved (already 0)

      const packet = Buffer.concat([header, data]);

      const socket = net.createConnection({ host: PIONEER_IP, port: PIONEER_PORT });

      socket.on('connect', () => {
        socket.write(packet);
      });

      socket.on('data', () => {
        socket.end();
        resolve();
      });

      socket.on('error', (err) => reject(err));

      socket.setTimeout(3000, () => {
        socket.destroy();
        reject(new Error('Timeout'));
      });
    } catch (err) {
      reject(err);
    }
  });
}

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

// ── Shield: Keypress ────────────────────────────────────────────────
app.post('/api/shield/keypress/:keycode', async (req, res) => {
  if (!VALID_KEYCODE.test(req.params.keycode)) {
    return res.status(400).json({ error: 'Invalid keycode' });
  }
  try {
    const cmd = `adb -s ${SHIELD_IP}:${SHIELD_PORT} shell input keyevent ${req.params.keycode}`;
    await execAsync(cmd);
    res.json({ ok: true });
  } catch {
    res.status(502).json({ error: 'Failed to reach Shield' });
  }
});

// ── Shield: Text input ──────────────────────────────────────────────
app.post('/api/shield/text', async (req, res) => {
  const { text } = req.body;
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_TEXT) {
    return res.status(400).json({ error: 'Invalid text' });
  }
  try {
    const escapedText = text.replace(/"/g, '\\"').replace(/\$/g, '\\$');
    const cmd = `adb -s ${SHIELD_IP}:${SHIELD_PORT} shell input text "${escapedText}"`;
    await execAsync(cmd);
    res.json({ ok: true });
  } catch {
    res.status(502).json({ error: 'Failed to reach Shield' });
  }
});

// ── Shield: Power toggle ────────────────────────────────────────────
app.post('/api/shield/power', async (req, res) => {
  try {
    const cmd = `adb -s ${SHIELD_IP}:${SHIELD_PORT} shell input keyevent 26`;
    await execAsync(cmd);
    res.json({ ok: true });
  } catch {
    res.status(502).json({ error: 'Failed to reach Shield' });
  }
});

// ── Pioneer: Volume Up ──────────────────────────────────────────────
app.post('/api/pioneer/volume-up', async (req, res) => {
  try {
    await sendPioneerCommand('!1MVLUP');
    res.json({ ok: true });
  } catch {
    res.status(502).json({ error: 'Failed to reach Pioneer' });
  }
});

// ── Pioneer: Volume Down ────────────────────────────────────────────
app.post('/api/pioneer/volume-down', async (req, res) => {
  try {
    await sendPioneerCommand('!1MVLDN');
    res.json({ ok: true });
  } catch {
    res.status(502).json({ error: 'Failed to reach Pioneer' });
  }
});

// ── Pioneer: Mute ──────────────────────────────────────────────────
app.post('/api/pioneer/mute', async (req, res) => {
  try {
    const { on } = req.body;
    const cmd = on ? '!1AMT01' : '!1AMT00';
    await sendPioneerCommand(cmd);
    res.json({ ok: true });
  } catch {
    res.status(502).json({ error: 'Failed to reach Pioneer' });
  }
});

// ── Pioneer: Power On/Off ──────────────────────────────────────────
app.post('/api/pioneer/power/:state', async (req, res) => {
  const state = req.params.state;
  if (!['on', 'off'].includes(state)) {
    return res.status(400).json({ error: 'Invalid state' });
  }
  try {
    const cmd = state === 'on' ? '!1PWR01' : '!1PWR00';
    await sendPioneerCommand(cmd);
    res.json({ ok: true });
  } catch {
    res.status(502).json({ error: 'Failed to reach Pioneer' });
  }
});

// ── Pioneer: Input/Source ──────────────────────────────────────────
app.post('/api/pioneer/input/:input', async (req, res) => {
  const input = req.params.input;
  if (!/^[0-9a-fA-F]{2}$/.test(input)) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  try {
    const cmd = `!1FN${input.toUpperCase()}`;
    await sendPioneerCommand(cmd);
    res.json({ ok: true });
  } catch {
    res.status(502).json({ error: 'Failed to reach Pioneer' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Roku Web Remote  →  http://0.0.0.0:${PORT}`);
  console.log(`Roku ECP target  →  ${ROKU_BASE}`);
  console.log(`Shield ADB target →  ${SHIELD_IP}:${SHIELD_PORT}`);
  console.log(`Pioneer target   →  ${PIONEER_IP}:${PIONEER_PORT}`);
});
