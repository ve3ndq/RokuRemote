#!/usr/bin/env bash
# deploy/setup.sh  –  Install Roku Web Remote on a Debian/Ubuntu VM
set -euo pipefail

APP_DIR="/opt/roku-remote"
SERVICE="roku-remote"
APP_USER="roku-remote"

echo "======================================="
echo "  Roku Web Remote  -  Debian Setup"
echo "======================================="

# ── 1. Node.js 20.x ────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "► Installing Node.js 20.x..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "✓ Node.js $(node --version) already present"
fi

# ── 2. System user ──────────────────────────────────────────────
if ! id "$APP_USER" &>/dev/null; then
  echo "► Creating system user '$APP_USER'..."
  sudo useradd -r -s /usr/sbin/nologin "$APP_USER"
else
  echo "✓ User '$APP_USER' already exists"
fi

# ── 3. Copy application files ───────────────────────────────────
echo "► Installing app to $APP_DIR..."
sudo mkdir -p "$APP_DIR"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
sudo rsync -a --delete \
  --exclude='node_modules' \
  --exclude='.git'         \
  "$REPO_ROOT/" "$APP_DIR/"
sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ── 4. Install npm dependencies ────────────────────────────────
echo "► Installing npm dependencies..."
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm install --omit=dev"

# ── 5. Systemd service ─────────────────────────────────────────
echo "► Installing systemd service..."
sudo cp "$APP_DIR/deploy/roku-remote.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE"
sudo systemctl restart "$SERVICE"

# ── Done ───────────────────────────────────────────────────────
LOCAL_IP=$(hostname -I | awk '{print $1}')
PORT=$(grep -E '^PORT=' "$APP_DIR/.env" "$REPO_ROOT/.env" 2>/dev/null | head -1 | cut -d= -f2 || echo 3000)

echo ""
echo "======================================="
echo "  Done! Remote available at:"
echo "  http://$LOCAL_IP:$PORT"
echo "======================================="
echo ""
sudo systemctl status "$SERVICE" --no-pager -l
