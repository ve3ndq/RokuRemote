# Roku Remote

Web-based remote control for a Roku device or Roku TV.

This project serves a small Express app that exposes a browser UI and proxies requests to the Roku External Control Protocol (ECP) on port `8060`. The frontend provides navigation controls, playback controls, volume controls, app launching, and text input.

## Features

- Browser-based remote UI optimized for phone-sized screens
- Roku keypress forwarding through a local Express server
- Text input sent character-by-character using Roku `Lit_` keypress events
- Installed app launcher with Roku app icons
- Device status and active app display
- Keyboard shortcuts for desktop use
- Debian/systemd deployment script included

## Requirements

- Node.js `18+`
- A Roku device reachable on your local network
- Network access from this server to the Roku on port `8060`

## Configuration

The server reads configuration from environment variables and optionally from a local `.env` file.

### Supported variables

- `PORT`: HTTP port for the web app. Default: `3000`
- `ROKU_IP`: IP address of the Roku device. Default: `10.10.116.28`

Example `.env`:

```env
PORT=3000
ROKU_IP=192.168.1.50
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

The server exposes a small API used by the frontend:

- `POST /api/keypress/:key`: send a Roku keypress
- `POST /api/text`: send text as JSON `{ "text": "..." }`
- `GET /api/apps`: fetch installed Roku apps as XML
- `GET /api/active-app`: fetch the active app as XML
- `GET /api/device-info`: fetch Roku device info as XML
- `POST /api/launch/:appId`: launch an installed app by numeric ID
- `GET /api/icon/:appId`: proxy an app icon image

Input is validated on the server before requests are forwarded to the Roku.

## Deployment

The `deploy/` directory contains a Debian/Ubuntu setup script and a systemd service file.

### Automated setup

Run the deployment script on the target machine:

```bash
bash deploy/setup.sh
```

The script will:

- install Node.js `20.x` if needed
- create a dedicated `roku-remote` system user
- clone or update the repository under `/opt/roku-remote`
- install production npm dependencies
- install and restart the `roku-remote` systemd service

### Systemd service

The included service file runs:

- working directory: `/opt/roku-remote`
- command: `/usr/bin/node server.js`

If you want custom settings in production, place a `.env` file in `/opt/roku-remote` before starting or restarting the service.

## Project structure

```text
.
├── server.js
├── package.json
├── public/
│   └── index.html
└── deploy/
    ├── roku-remote.service
    ├── setup.sh
    └── ssh-copy-id.ps1
```

## Security note

This project is designed for use on a trusted local network. It does not include authentication or authorization, and it can control the configured Roku device directly. Do not expose it to the public internet without adding access controls.