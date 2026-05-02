# Roku Web Remote

Web-based remote control for Roku TVs, NVIDIA Shield devices, and Pioneer receivers.

This project serves an Express app that exposes a browser UI with tabs for each device type, proxying requests to:
- **Roku**: External Control Protocol (ECP) on port `8060`
- **NVIDIA Shield**: Android Debug Bridge (ADB) on port `5555`
- **Pioneer Receiver**: Onkyo eISCP protocol on port `60128`

## Features

- Browser-based remote UI with three device tabs (Roku, Shield, Pioneer)
- Roku navigation, app launching, text input, and input switching
- Shield navigation via ADB with keyevent codes, text input, and power control
- Pioneer volume/mute control with absolute volume tracking
- Device status display
- Mobile-optimized responsive design
- Debian/systemd deployment with automatic ADB connection on startup

## Requirements

- Node.js `20.x`
- A Roku device on port `8060` (optional)
- An NVIDIA Shield device on port `5555` with ADB debugging enabled (optional)
- A Pioneer receiver on port `60128` (optional)
- Network access from this server to target devices

## Configuration

The server reads configuration from environment variables and optionally from a local `.env` file.

### Supported variables

**Web server:**
- `PORT`: HTTP port for the web app. Default: `3000`

**Roku TV:**
- `ROKU_IP`: IP address of the Roku device. Default: `10.10.116.28`

**NVIDIA Shield:**
- `SHIELD_IP`: IP address of Shield device. Default: `10.10.176.129`
- `SHIELD_PORT`: ADB port. Default: `5555`

**Pioneer Receiver:**
- `PIONEER_IP`: IP address of Pioneer receiver. Default: `10.10.48.10`
- `PIONEER_PORT`: eISCP port. Default: `60128`

Example `.env`:

```env
PORT=3000
ROKU_IP=10.10.116.28
SHIELD_IP=10.10.176.129
SHIELD_PORT=5555
PIONEER_IP=10.10.48.10
PIONEER_PORT=60128
```

## Run locally

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

If the Roku is reachable, the UI will show the device name and currently active app.

## Keyboard shortcuts

When the text field is not focused, the UI supports these desktop shortcuts:

- Arrow keys: directional navigation
- `Enter`: OK / Select
- `Backspace`: Back
- `Escape`: Home
- `Space`: Play / Pause

## HTTP API

The server exposes endpoints for each device type:

**Roku:**
- `POST /api/keypress/:key`: send a Roku ECP keypress
- `POST /api/text`: send text as JSON `{ "text": "..." }`
- `GET /api/apps`: fetch installed apps as XML
- `GET /api/active-app`: fetch active app as XML
- `GET /api/device-info`: fetch device info as XML
- `POST /api/launch/:appId`: launch an app by ID
- `GET /api/icon/:appId`: proxy app icon
- `POST /api/input/:input`: switch to HDMI input

**NVIDIA Shield:**
- `POST /api/shield/connect`: establish ADB connection
- `POST /api/shield/keypress/:keycode`: send Android keyevent
- `POST /api/shield/text`: send text as JSON `{ "text": "..." }`
- `POST /api/shield/power`: toggle power

**Pioneer Receiver:**
- `POST /api/pioneer/power/:state`: power on/off (state: "on" or "off")
- `POST /api/pioneer/volume-up`: increment volume by 3
- `POST /api/pioneer/volume-down`: decrement volume by 3
- `POST /api/pioneer/mute`: toggle mute as JSON `{ "on": true/false }`
- `POST /api/pioneer/input/:input`: switch input (hex code)

## Device Setup

### Shield (optional)

1. On the Shield device: **Settings → Developer options → ADB debugging (ON)**
2. Click the **Connect** button in the Shield tab of the remote UI
3. Accept the authorization prompt on the Shield device
4. Subsequent connections will be automatic

### Pioneer (optional)

No additional setup required. Ensure the receiver is powered on and reachable on your network.

## Deployment

The `deploy/` directory contains a Debian/Ubuntu setup script and a systemd service file.

### Automated setup

Run the deployment script on the target machine:

```bash
bash deploy/setup.sh
```

The script will:

- Install Node.js `20.x` if needed
- Install ADB tools for Shield support
- Create a dedicated `roku-remote` system user
- Clone or update the repository under `/opt/roku-remote`
- Install production npm dependencies
- Install and restart the `roku-remote` systemd service
- Attempt initial ADB connection to Shield (if configured)

### Systemd service

The included service file runs:

- **Working directory:** `/opt/roku-remote`
- **Command:** `/usr/bin/node server.js`
- **User:** `roku-remote` (system user with home in `/home/roku-remote`)
- **Auto-restart:** On failure with 5s delay
- **ADB startup:** Automatic connection to Shield on service start (non-fatal if Shield offline)

If you want custom settings in production, place a `.env` file in `/opt/roku-remote` before starting or restarting the service.

### Security

The service runs with strict security hardening:
- `ProtectHome=false` (allows ADB access to user home directory)
- `ProtectSystem=strict`
- `NoNewPrivileges=true`
- `PrivateTmp=true`

## Project structure

```text
.
├── server.js              # Express server with device APIs
├── package.json
├── .env                   # Configuration (IP addresses, ports)
├── public/
│   └── index.html         # Single-page app with three device tabs
└── deploy/
    ├── roku-remote.service  # systemd service file
    └── setup.sh             # Debian/Ubuntu deployment script
```

## Security note

This project is designed for use on a trusted local network only. It does not include authentication or authorization. It can directly control configured devices (Roku, Shield, Pioneer). Do not expose it to the public internet without adding access controls (e.g., firewall rules, reverse proxy with authentication).