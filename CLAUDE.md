# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Roku Web Remote** is a web-based remote control supporting Roku TVs, NVIDIA Shield devices, and Pioneer receivers. Built with Node.js/Express, it serves a mobile-optimized single-page frontend with device-specific tabs and proxies commands to:
- **Roku**: HTTP External Control Protocol (ECP) on port 8060
- **Shield**: ADB (Android Debug Bridge) on port 5555
- **Pioneer**: Onkyo eISCP protocol on port 60128

## Setup & Running

```bash
# Install dependencies
npm install

# Start development server (reads .env for PORT and ROKU_IP)
npm start
# Defaults: PORT=3000, ROKU_IP=10.10.116.28
# Logs output: "Roku Web Remote  →  http://0.0.0.0:{PORT}"

# For production deployment on Debian/Ubuntu
bash deploy/setup.sh
```

**Configuration (.env file):**
```
PORT=3000
ROKU_IP=10.10.116.28
SHIELD_IP=10.10.176.129
SHIELD_PORT=5555
PIONEER_IP=10.10.48.10
PIONEER_PORT=60128
```

## Architecture

### Server (`server.js`)

Single Express server with three concerns:

1. **Frontend serving** – Static HTML/CSS/JS from `public/index.html` via `express.static()`
2. **Device proxies** – Three device-specific API implementations:
   - **Roku**: HTTP requests to `http://{ROKU_IP}:8060` (ECP protocol)
   - **Shield**: ADB shell commands via `execAsync()` (Android keyevent codes)
   - **Pioneer**: Binary eISCP packets via `net.createConnection()` (Onkyo protocol)

The server listens on `0.0.0.0:{PORT}` and routes requests to the appropriate device backend.

**Input validation:** All user inputs are validated with regex:
- `VALID_KEY = /^[A-Za-z0-9_]+$/` – Roku ECP key names
- `VALID_ID = /^\d+$/` – Roku app IDs
- `VALID_KEYCODE = /^\d+$/` – Shield Android keyevent codes
- `MAX_TEXT = 500` – Text input length limit (both Roku and Shield)

**Error handling:** Device connectivity errors (Roku, Shield, Pioneer) return 502 (Bad Gateway). Client errors (invalid input) return 400.

**Key patterns:**
- Roku text: character-by-character via `Lit_{encoded_char}` (server handles encoding)
- Shield text: full strings sent at once via ADB `input text` command
- Pioneer commands: binary eISCP packets with proper ISCP header + size fields + data payload
- Roku app icons: proxied with browser caching headers (`Cache-Control: max-age=86400`)
- Pioneer volume: absolute level tracking on client (0x00-0x60) with +3/-3 increment per click

### Frontend (`public/index.html`)

Single-file frontend with embedded CSS and vanilla JavaScript. Mobile-first design (max 390px width). Features three device tabs:
- **Roku tab**: Navigation, apps list, app launcher, text input, input switching
- **Shield tab**: Navigation (D-pad, Home, Back), text input, power toggle, Connect button with status
- **Pioneer tab**: Power on/off, volume ±, mute toggle, input selection (HDMI 1-4, Audio, Optical, Coax, DVD)

**HTTP client pattern:** Fetch-based with error handling. All commands POST to `/api/*` endpoints specific to each device.

## Deployment

**systemd service** (`deploy/roku-remote.service`):
- Runs as dedicated user `roku-remote` with home in `/home/roku-remote`
- Installs to `/opt/roku-remote`
- Auto-restart on failure (5s delay)
- `ExecStartPre`: attempts ADB connection (non-fatal with `-` prefix so service starts even if Shield is offline)
- Strict security hardening: `ProtectSystem=strict`, `ProtectHome=false` (ADB needs home access), `NoNewPrivileges=true`, `PrivateTmp=true`
- Logs to systemd journal

**Setup script** (`deploy/setup.sh`):
- Installs Node.js 20.x via NodeSource
- Installs ADB tools for Shield support
- Creates app user with proper home directory (`/home/roku-remote`)
- Sets up `.android` directory for ADB (required for daemon startup)
- Clones or updates repository under `/opt/roku-remote`
- Installs dependencies with `--omit=dev`
- Enables and starts systemd service
- Reports local URL, service status, and device setup instructions

## NVIDIA Shield Support

Separate tab on the web app for Shield remote control via ADB (Android Debug Bridge).

**Configuration (.env additions):**
```
SHIELD_IP=10.10.176.129
SHIELD_PORT=5555
```

**Architecture:**

Shield uses the same REST API pattern as Roku. Server executes ADB commands via `adb -s {IP}:{PORT} shell ...`:

- **Navigation**: Android keyevent codes (UP=19, DOWN=20, LEFT=21, RIGHT=22, SELECT=23, HOME=3, BACK=4)
- **Text input**: `input text "string"` (full strings sent at once)
- **Power**: keyevent 26 (power toggle)
- **Error handling**: ADB commands fail gracefully if Shield is unreachable (same 502 pattern as Roku)

**Endpoints (mirrored to Roku pattern):**
- `POST /api/shield/keypress/:keycode` – Send keyevent
- `POST /api/shield/text` – Send text input
- `POST /api/shield/power` – Toggle power

**Setup script** (`deploy/setup.sh`):
- Installs `adb` tools via apt
- No authentication needed (assuming Shield is on trusted network; deploy script can add manual setup note if needed)

**Frontend:**
- "Shield" tab with navigation, text input, power, and Connect button with status
- Graceful fallback if Shield is offline

## Pioneer Receiver Support

Separate tab for Pioneer VSX-832 (Onkyo eISCP protocol).

**Configuration (.env additions):**
```
PIONEER_IP=10.10.48.10
PIONEER_PORT=60128
```

**Protocol: Onkyo eISCP**

Binary packet format with ISCP header:
- Bytes 0-3: `"ISCP"` (ASCII)
- Bytes 4-7: header size (16 in big-endian)
- Bytes 8-11: data size in big-endian
- Byte 12: version (0x01)
- Bytes 13-15: reserved (0x00)
- Payload: command text ending with `\r`

**Commands (MVL, AMT, PWR, FN):**
- `!1MVL{HEX}` – Absolute volume (0x00-0x60, 0-96 decimal)
- `!1AMT01` / `!1AMT00` – Mute on/off
- `!1PWR01` / `!1PWR00` – Power on/off
- `!1FN{HEX}` – Input selection (HDMI: 01-04, Audio: 05, Optical: 10, Coax: 11, DVD: 04)

**Endpoints:**
- `POST /api/pioneer/volume-up` – Increment by 3
- `POST /api/pioneer/volume-down` – Decrement by 3
- `POST /api/pioneer/mute` – Body: `{ "on": true/false }`
- `POST /api/pioneer/power/:state` – State: "on" or "off"
- `POST /api/pioneer/input/:input` – Input: hex code (e.g., "01" for HDMI1)

**State tracking:**
- Client-side `pioneerVolume` variable (initialized at 0x50 / 80 decimal)
- Updated on each volume up/down command
- Allows predictable volume control despite no feedback from receiver
