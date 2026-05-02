#!/usr/bin/env bash
# deploy/setup.sh  –  Install Roku Web Remote on Debian/Ubuntu
# Supports: Roku TV, NVIDIA Shield (ADB), Pioneer Receiver (eISCP)
set -euo pipefail

APP_DIR="/opt/roku-remote"
SERVICE="roku-remote"
APP_USER="roku-remote"

echo "=========================================="
echo "  Roku Web Remote - Debian/Ubuntu Setup"
echo "  (Roku + Shield + Pioneer)"
echo "=========================================="

# ── 1. Node.js 20.x ────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "► Installing Node.js 20.x..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "✓ Node.js $(node --version) already present"
fi

# ── 1a. ADB tools (for Shield support) ─────────────────────────
if ! command -v adb &>/dev/null; then
  echo "► Installing ADB tools..."
  sudo apt-get install -y android-tools-adb
else
  echo "✓ ADB $(adb --version | head -1) already present"
fi

# ── 2. System user ──────────────────────────────────────────────
if ! id "$APP_USER" &>/dev/null; then
  echo "► Creating system user '$APP_USER'..."
  sudo useradd -r -m -s /usr/sbin/nologin "$APP_USER"
else
  # Ensure home dir exists even if user was created without -m
  sudo mkhomedir_helper "$APP_USER" 2>/dev/null || true
  echo "✓ User '$APP_USER' already exists"
fi

# ── 2a. ADB home directory (for Shield support) ───────────────────
APP_HOME=$(getent passwd "$APP_USER" | cut -d: -f6)
if [ -n "$APP_HOME" ] && [ "$APP_HOME" != "/" ]; then
  echo "► Setting up ADB home directory..."
  sudo mkdir -p "$APP_HOME/.android"
  sudo chown "$APP_USER:$APP_USER" "$APP_HOME/.android"
  sudo chmod 700 "$APP_HOME/.android"
fi

# ── 3. Clone / update application files from git ───────────────
REPO_URL="https://github.com/ve3ndq/RokuRemote.git"
echo "► Deploying app to $APP_DIR from $REPO_URL..."
if [ -d "$APP_DIR/.git" ]; then
  echo "  (repo exists – pulling latest)"
  git -C "$APP_DIR" pull --ff-only
else
  # Remove any non-git remnants (e.g. from a prior rsync deploy), then clone fresh
  sudo rm -rf "$APP_DIR"
  sudo mkdir -p "$(dirname "$APP_DIR")"
  git clone "$REPO_URL" "$APP_DIR"
fi
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
PORT=$(grep -E '^PORT=' "$APP_DIR/.env" 2>/dev/null | head -1 | cut -d= -f2 || echo 3000)

echo ""
echo "=========================================="
echo "  Done! Remote available at:"
echo "  http://$LOCAL_IP:$PORT"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. NVIDIA Shield setup (if using):"
echo "   • On Shield: Settings > Developer options > ADB debugging (ON)"
echo "   • Click Connect button in Shield tab of remote UI"
echo "   • Accept authorization prompt on Shield device"
echo "   • Configure .env: SHIELD_IP={SHIELD_IP}"
echo ""
echo "2. Pioneer receiver setup (if using):"
echo "   • Ensure receiver is powered on and reachable"
echo "   • Configure .env: PIONEER_IP={IP} PIONEER_PORT=60128"
echo ""
echo "3. View service status:"
echo ""
sudo systemctl status "$SERVICE" --no-pager -l
