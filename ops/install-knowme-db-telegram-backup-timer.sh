#!/usr/bin/env bash
# Install an opt-in daily encrypted PostgreSQL backup timer on the trusted VPS.
set -Eeuo pipefail
umask 077
if [[ "$(id -u)" != 0 ]]; then echo "Run as root" >&2; exit 2; fi
SCRIPT=/var/lib/nex/runtime/knowme/db-telegram-backup.mjs
ENV=/var/lib/nex/runtime/knowme/knowme.env
SERVICE=/etc/systemd/system/knowme-telegram-db-backup.service
TIMER=/etc/systemd/system/knowme-telegram-db-backup.timer
test -s "$SCRIPT" && test -s "$ENV"
node --check "$SCRIPT"
command -v flock >/dev/null
node - <<'NODE'
const {readFileSync}=require('node:fs');
const values=Object.fromEntries(readFileSync('/var/lib/nex/runtime/knowme/knowme.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')&&!x.startsWith('#')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)]}));
if(!/^-100[1-9]\d{7,}$/.test(values.MEDIA_TELEGRAM_DATABASE_CHAT_ID||'') || !/^[0-9a-fA-F]{64}$/.test(values.KNOWME_DB_BACKUP_KEY||'')) throw Error('Database channel or encryption key not configured');
NODE
cat > "$SERVICE" <<'UNIT'
[Unit]
Description=KnowMe encrypted PostgreSQL backup to private Telegram Database channel
Wants=docker.service network-online.target
After=docker.service network-online.target
[Service]
Type=oneshot
User=root
Group=root
UMask=0077
WorkingDirectory=/var/lib/nex/runtime/knowme
ExecStart=/usr/bin/flock -n /run/lock/knowme-telegram-db-backup.lock /usr/bin/node /var/lib/nex/runtime/knowme/db-telegram-backup.mjs
StandardOutput=append:/var/lib/nex/runtime/knowme/db-telegram-receipts.jsonl
StandardError=journal
TimeoutStartSec=1200
NoNewPrivileges=true
PrivateTmp=true
UNIT
cat > "$TIMER" <<'UNIT'
[Unit]
Description=Schedule encrypted KnowMe PostgreSQL backups every night
[Timer]
OnCalendar=*-*-* 02:10:00 UTC
AccuracySec=1min
RandomizedDelaySec=10min
Persistent=true
Unit=knowme-telegram-db-backup.service
[Install]
WantedBy=timers.target
UNIT
chmod 0644 "$SERVICE" "$TIMER"
systemctl daemon-reload
systemctl enable --now knowme-telegram-db-backup.timer
systemctl is-active --quiet knowme-telegram-db-backup.timer
echo "KNOWME_DATABASE_BACKUP_TIMER=ACTIVE; ENCRYPTED=YES; FREQUENCY=DAILY"
