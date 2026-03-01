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
  sudo useradd -r -m -s /usr/sbin/nologin "$APP_USER"
else
  # Ensure home dir exists even if user was created without -m
  sudo mkhomedir_helper "$APP_USER" 2>/dev/null || true
  echo "✓ User '$APP_USER' already exists"
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
echo "======================================="
echo "  Done! Remote available at:"
echo "  http://$LOCAL_IP:$PORT"
echo "======================================="
echo ""
sudo systemctl status "$SERVICE" --no-pager -l
