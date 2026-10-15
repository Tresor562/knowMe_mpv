#!/usr/bin/env bash
# Operator-only VPS deployment: backup first; target the live KnowMe Web SHA.
set -Eeuo pipefail
umask 077
[ "$(id -u)" -eq 0 ] || { echo 'Run as root (sudo bash).' >&2; exit 1; }
for tool in curl node git docker flock mktemp; do command -v "$tool" >/dev/null || { echo "Missing $tool" >&2; exit 1; }; done
exec 9>/var/lock/knowme-112-rollout.lock
flock -n 9 || { echo 'Another rollout is running.' >&2; exit 1; }
SOURCE=/opt/nex/apps/public/knowme/source
DB=knowme-postgres
BACKUP_DIR=/var/backups/knowme
[ -d "$SOURCE/.git" ] || { echo 'Existing KnowMe source checkout not found.' >&2; exit 1; }
docker info >/dev/null
docker exec "$DB" pg_isready -U knowme -d knowme >/dev/null
WEB="$(curl -fsS --max-time 15 https://knowme-nextech.vercel.app/api/version)"
SHA="$(printf '%s' "$WEB" | node -e '
let b="";process.stdin.on("data",x=>b+=x);process.stdin.on("end",()=>{
const x=JSON.parse(b);
if(x.platform!=="web"||x.version!=="1.1.2"||!/^[a-f0-9]{40}$/i.test(x.commit||"")) process.exit(4);
process.stdout.write(x.commit);});')"
printf 'Target KnowMe Web commit: %s\n' "$SHA"
install -d -m 700 "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup="$BACKUP_DIR/pre-knowme-112-$stamp.dump"
envbackup="$BACKUP_DIR/pre-knowme-112-$stamp.env"
if [ -f /var/lib/nex/runtime/knowme/knowme.env ]; then
  cp -p /var/lib/nex/runtime/knowme/knowme.env "$envbackup"
  chmod 600 "$envbackup"
fi
docker exec "$DB" pg_dump -U knowme -d knowme -Fc > "$backup"
[ -s "$backup" ] || { echo 'Empty database backup; refusing deployment.' >&2; exit 1; }
docker exec -i "$DB" pg_restore -l < "$backup" >/dev/null
chmod 600 "$backup"
printf 'Database backup validated: %s\n' "$backup"
git -C "$SOURCE" fetch --no-tags origin "$SHA"
temp="$(mktemp -d /tmp/knowme-rollout.XXXXXXXX)"
trap 'rm -rf "$temp"' EXIT
git -C "$SOURCE" show "$SHA:ops/deploy-knowme-vps.mjs" > "$temp/deploy.mjs"
test -s "$temp/deploy.mjs"
# Publish the verified OPTIONAL GitHub preview to the current installed APK
# only after preserving the previous runtime .env above.
ENV_FILE=/var/lib/nex/runtime/knowme/knowme.env
[ -f "$ENV_FILE" ] || { echo 'KnowMe runtime environment is missing.' >&2; exit 1; }
node - "$ENV_FILE" <<'NODE'
const fs=require('node:fs');
const path=process.argv[2];
const settings={
  KNOWME_ANDROID_UPDATE_VERSION_CODE:'4',
  KNOWME_ANDROID_UPDATE_VERSION:'1.1.2',
  KNOWME_ANDROID_UPDATE_URL:'https://github.com/Tresor562/knowMe_mpv/releases/download/v1.1.2-preview/KnowMe-1.1.2-preview.apk',
  KNOWME_ANDROID_UPDATE_SHA256:'ca5701f751d196403ab6099c2de63027106c2b21c8cf4fb84320434f32fa8d1c',
  KNOWME_ANDROID_UPDATE_NOTES:'KnowMe 1.1.2, préversion Android Debug : profils, amitiés, publications et mises à jour. Installation facultative.',
  KNOWME_ANDROID_UPDATE_REQUIRED:'false',
  KNOWME_ANDROID_AUTO_DISCOVER_GITHUB:'true'
};
const rows=fs.readFileSync(path,'utf8').split(/\r?\n/).filter(row=>
  row && !Object.keys(settings).some(key=>row.startsWith(key+'=')));
for (const [key,value] of Object.entries(settings)) rows.push(key+'='+value);
const temp=path+'.knowme-update-tmp';
fs.writeFileSync(temp,rows.join('\n')+'\n',{mode:0o600});
fs.chmodSync(temp,0o600);
fs.renameSync(temp,path);
NODE
KNOWME_DEPLOY_SHA="$SHA" node "$temp/deploy.mjs"
# Verify local and HTTPS public endpoints, and refuse a false success.
for URL in http://127.0.0.1:4000/platform-sync/version https://knowme-nextech.vercel.app/api/knowme/platform-sync/version; do
  RESPONSE="$(curl -fsS --max-time 15 "$URL")"
  printf '%s' "$RESPONSE" | EXPECTED_SHA="$SHA" node -e '
let b="";process.stdin.on("data",x=>b+=x);process.stdin.on("end",()=>{
const x=JSON.parse(b);
if(x.platform!=="api"||x.version!=="1.1.2"||x.commit!==process.env.EXPECTED_SHA)process.exit(7);
});'
done
printf 'KnowMe Web/API 1.1.2 now share SHA %s. Backup: %s\n' "$SHA" "$backup"
