#!/usr/bin/env bash
set -euo pipefail

# Install once on the KnowMe VPS using an authorized administrator terminal.
# After that, the VPS itself pulls published APKs: no GitHub SSH secrets.
[[ "$(id -u)" -eq 0 ]] || { echo "Run as root or sudo on the VPS." >&2; exit 1; }
command -v node >/dev/null || { echo "Node.js 22+ is required." >&2; exit 1; }
command -v apksigner >/dev/null || { echo "Android apksigner is required." >&2; exit 1; }
command -v aapt >/dev/null || { echo "Android aapt is required." >&2; exit 1; }
NODE_BIN="$(readlink -f "$(command -v node)")"
SIGNER_BIN="$(readlink -f "$(command -v apksigner)")"
AAPT_BIN="$(readlink -f "$(command -v aapt)")"
NODE_MAJOR="$("$NODE_BIN" -p 'Number(process.versions.node.split(".")[0])')"
[[ "$NODE_MAJOR" =~ ^[0-9]+$ && "$NODE_MAJOR" -ge 22 ]] ||
  { echo "KnowMe requires Node.js 22+." >&2; exit 1; }

# Bootstrap directly from the checked-out KnowMe repository, instead of
# requiring an unrelated /opt/nex/ops checkout to exist beforehand.
REPO_OPS="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
for file in sync-knowme-android-vps.mjs publish-knowme-android-vps.mjs; do
  [[ -f "$REPO_OPS/$file" ]] ||
    { echo "Required KnowMe update script missing: $REPO_OPS/$file" >&2; exit 1; }
done
SOURCE=/opt/nex/ops/knowme-android-updates
install -d -o root -g root -m 0755 "$SOURCE/ops"
for file in sync-knowme-android-vps.mjs publish-knowme-android-vps.mjs; do
  install -o root -g root -m 0644 "$REPO_OPS/$file" "$SOURCE/ops/$file"
done

user=knowme-updates
if ! id -u "$user" >/dev/null 2>&1; then
  useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin "$user"
fi
install -d -o "$user" -g "$user" -m 0755 /var/lib/knowme-android-updates
# Node must be executable by the isolated service account (a root-only nvm
# installation is not suitable for a ProtectHome=true systemd service).
runuser -u "$user" -- "$NODE_BIN" --version >/dev/null ||
  { echo "Node.js is not executable by $user; install a system-wide Node.js 22+ runtime." >&2; exit 1; }

cat > /etc/systemd/system/knowme-android-updates.service <<SERVICE
[Unit]
Description=Mirror verified KnowMe Android APK releases to own VPS
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
User=knowme-updates
Group=knowme-updates
Environment=KNOWME_ANDROID_UPDATES_HOST_DIR=/var/lib/knowme-android-updates
Environment=KNOWME_APKSIGNER_PATH=$SIGNER_BIN
Environment=KNOWME_AAPT_PATH=$AAPT_BIN
ExecStart=$NODE_BIN /opt/nex/ops/knowme-android-updates/ops/sync-knowme-android-vps.mjs
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
systemctl restart knowme-android-updates.timer
# Validate that the timer exists and is enabled; do not claim an APK is live
# until the existing KnowMe API container has been redeployed with the mount.
systemctl is-enabled knowme-android-updates.timer
echo "KnowMe APK mirror installed. After API deploy, check /mobile-updates/android."
