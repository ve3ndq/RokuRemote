# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Roku Web Remote** is a web-based remote control for Roku TVs running on Node.js/Express. It acts as an HTTP proxy to the Roku's External Control Protocol (ECP) and serves a mobile-optimized single-page frontend.

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
```

## Architecture

### Server (`server.js`)

Single Express server with two concerns:

1. **Frontend serving** – Static HTML/CSS/JS from `public/index.html` via `express.static()`
2. **Roku ECP proxy** – REST API that wraps Roku's HTTP protocol

The server listens on `0.0.0.0:{PORT}` and targets the Roku device at `http://{ROKU_IP}:8060` (ECP default port).

**Input validation:** All user inputs are validated with regex:
- `VALID_KEY = /^[A-Za-z0-9_]+$/` – Roku ECP key names (keypress commands)
- `VALID_ID = /^\d+$/` – Roku channel/app IDs
- `MAX_TEXT = 500` – Text input length limit

**Error handling:** Roku connectivity errors return 502 (Bad Gateway). Client errors (invalid input) return 400.

**Key patterns:**
- Text input is sent character-by-character via `Lit_{encoded_char}` keypress (server handles encoding)
- App icons are proxied from Roku with browser caching headers (`Cache-Control: max-age=86400`)
- XML responses from Roku are proxied directly (apps list, active app, device info)

### Frontend (`public/index.html`)

Single-file frontend with embedded CSS and vanilla JavaScript. Mobile-first design (max 390px width). Uses color variables for dark theme.

**HTTP client pattern:** Fetch-based with error handling. All commands POST to `/api/*` and GET device state as needed.

## Deployment

**systemd service** (`deploy/roku-remote.service`):
- Runs as dedicated user `roku-remote`
- Installs to `/opt/roku-remote`
- Auto-restart on failure (5s delay)
- Strict security hardening (ProtectSystem, ProtectHome, NoNewPrivileges)
- Logs to systemd journal

**Setup script** (`deploy/setup.sh`):
- Installs Node.js 20.x via NodeSource
- Creates app user and directory
- Copies app files (excludes `node_modules`, `.git`)
- Installs dependencies with `--omit=dev`
- Enables and starts systemd service
- Reports local URL and service status

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
- New "Shield" tab alongside "Roku" tab
- Same button layout and controls as Roku tab
- Graceful fallback if Shield is offline
