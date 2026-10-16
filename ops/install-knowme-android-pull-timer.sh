#!/usr/bin/env bash
set -euo pipefail

# Install once on the KnowMe VPS using an authorized administrator terminal.
# After that, the VPS itself pulls published APKs: no GitHub SSH secrets.
[[ "$(id -u)" -eq 0 ]] || { echo "Run as root or sudo on the VPS." >&2; exit 1; }
command -v node >/dev/null || { echo "Node.js 22+ is required." >&2; exit 1; }
command -v apksigner >/dev/null || { echo "Android apksigner is required." >&2; exit 1; }
command -v aapt >/dev/null || { echo "Android aapt is required." >&2; exit 1; }
SOURCE=/opt/nex/apps/public/knowme/source
[[ -f "$SOURCE/ops/sync-knowme-android-vps.mjs" ]] ||
  { echo "Deploy the KnowMe source checkout to $SOURCE first." >&2; exit 1; }

user=knowme-updates
if ! id -u "$user" >/dev/null 2>&1; then
  useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin "$user"
fi
install -d -o "$user" -g "$user" -m 0755 /var/lib/knowme-android-updates

cat > /etc/systemd/system/knowme-android-updates.service <<'SERVICE'
[Unit]
Description=Mirror verified KnowMe Android APK releases to own VPS
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
User=knowme-updates
Group=knowme-updates
Environment=KNOWME_ANDROID_UPDATES_HOST_DIR=/var/lib/knowme-android-updates
ExecStart=/usr/bin/env node /opt/nex/apps/public/knowme/source/ops/sync-knowme-android-vps.mjs
TimeoutStartSec=240
UMask=0022
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/knowme-android-updates
ProtectKernelModules=true
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true

[Install]
WantedBy=multi-user.target
SERVICE
cat > /etc/systemd/system/knowme-android-updates.timer <<'TIMER'
[Unit]
Description=Poll official KnowMe APK releases every five minutes

[Timer]
OnBootSec=2min
OnUnitInactiveSec=5min
RandomizedDelaySec=30s
Persistent=true
Unit=knowme-android-updates.service

[Install]
WantedBy=timers.target
TIMER

systemctl daemon-reload
systemctl enable --now knowme-android-updates.timer
# Validate that the timer exists and is enabled; do not claim an APK is live
# until the existing KnowMe API container has been redeployed with the mount.
systemctl is-enabled knowme-android-updates.timer
echo "KnowMe APK mirror installed. After API deploy, check /mobile-updates/android."
