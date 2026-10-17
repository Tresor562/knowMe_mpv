#!/usr/bin/env bash
# Install or repair the first-party KnowMe VPS API+Web release timer.
set -Eeuo pipefail
[[ "$(id -u)" -eq 0 ]] || { echo 'Root is required'; exit 1; }
SOURCE="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd -P)"
for file in deploy-knowme-vps.mjs deploy-knowme-web-vps.mjs sync-knowme-platform-vps.mjs; do
  test -s "$SOURCE/$file" || { echo "Missing $file"; exit 1; }
  node --check "$SOURCE/$file" >/dev/null
done
test "$(node -p 'Number(process.versions.node.split(".")[0])')" -ge 22
for tool in flock docker git curl nginx systemctl; do command -v "$tool" >/dev/null; done
TARGET=/opt/nex/ops/knowme-platform/ops
install -d -o root -g root -m 0755 "$TARGET"
for file in deploy-knowme-vps.mjs deploy-knowme-web-vps.mjs sync-knowme-platform-vps.mjs; do
  install -o root -g root -m 0644 "$SOURCE/$file" "$TARGET/$file"
done
NODE_BIN="$(readlink -f "$(command -v node)")"
FLOCK_BIN="$(readlink -f "$(command -v flock)")"
cat > /etc/systemd/system/knowme-platform-sync.service <<SERVICE
[Unit]
Description=Deploy qualified KnowMe Android/Web/API release on VPS
After=network-online.target docker.service knowme-android-updates.service
Wants=network-online.target

[Service]
Type=oneshot
User=root
Environment=NODE_ENV=production
WorkingDirectory=/opt/nex/ops/knowme-platform
ExecStart=$FLOCK_BIN -n /run/lock/knowme-platform-sync.lock $NODE_BIN $TARGET/sync-knowme-platform-vps.mjs
TimeoutStartSec=3600
UMask=0077
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SERVICE
cat > /etc/systemd/system/knowme-platform-sync.timer <<'TIMER'
[Unit]
Description=Check verified KnowMe release for Web/API every ten minutes

[Timer]
OnBootSec=4min
OnUnitInactiveSec=10min
RandomizedDelaySec=30s
Persistent=true
Unit=knowme-platform-sync.service

[Install]
WantedBy=timers.target
TIMER
systemctl daemon-reload
systemctl enable --now knowme-platform-sync.timer
systemctl is-enabled knowme-platform-sync.timer
systemctl is-active knowme-platform-sync.timer
echo 'KnowMe platform reconciler installed. Run systemctl start knowme-platform-sync.service for initial release.'
