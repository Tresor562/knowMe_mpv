import { createReadStream, existsSync, lstatSync, readFileSync, statSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { join } from 'node:path';
import { BadRequestException, Controller, Get, Headers, NotFoundException, Param, Res, ServiceUnavailableException, StreamableFile } from '@nestjs/common';

// Expo Updates protocol v1. Fail closed until a native client with an embedded
// code-signing certificate and a matching private key on the VPS is deployed.
type ExpoAsset = { key:string; hash:string; contentType:string; url:string; fileExtension?:string };
type ExpoManifest = {
  id:string; createdAt:string; runtimeVersion:string;
  launchAsset:ExpoAsset; assets:ExpoAsset[]; metadata:Record<string,string>;
  extra:{ expoClient:Record<string,unknown> }
};
type ExpoResponse = { setHeader(name:string,value:string):void; status(code:number):ExpoResponse };
const RUNTIME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/;
const SHA = /^[0-9a-f]{64}$/;
const CHANNEL = /^(preview|production)$/;
const ROOT = process.env.KNOWME_OTA_STORAGE_DIR || '/var/lib/knowme-expo-updates';
const URL_PREFIX = process.env.KNOWME_OTA_PUBLIC_URL || '';
const KEY_PATH = process.env.KNOWME_OTA_SIGNING_KEY_PATH || '';

function serviceEnabled() {
  if (process.env.KNOWME_OTA_ENABLED !== 'true' || !KEY_PATH || !existsSync(KEY_PATH)) return false;
  try {
    const parsed = new URL(URL_PREFIX);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password &&
      !parsed.search && !parsed.hash && parsed.pathname.endsWith('/mobile-updates/ota');
  } catch { return false; }
}

export function safeRuntime(value: string | undefined) {
  return Boolean(value && RUNTIME.test(value) && !value.includes('..'));
}

function validateAsset(input: unknown, prefix: string): input is ExpoAsset {
  if (!input || typeof input !== 'object') return false;
  const row = input as Record<string,unknown>;
  if (typeof row.key !== 'string' || row.key.length < 1 || row.key.length > 128 ||
    typeof row.hash !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(row.hash) ||
    typeof row.contentType !== 'string' || row.contentType.length > 120 ||
    typeof row.url !== 'string' || !row.url.startsWith(prefix + '/assets/')) return false;
  const digest = row.url.slice((prefix + '/assets/').length);
  if (!SHA.test(digest)) return false;
  if (row.fileExtension !== undefined &&
    (typeof row.fileExtension !== 'string' || !/^\.[a-z0-9]{1,8}$/.test(row.fileExtension))) return false;
  return true;
}

export function validateExpoManifest(manifest: unknown, runtime: string, prefix: string):
  manifest is ExpoManifest {
  if (!manifest || typeof manifest !== 'object') return false;
  const value = manifest as Record<string,unknown>;
  if (typeof value.id !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.id) ||
    typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) ||
    value.runtimeVersion !== runtime || !Array.isArray(value.assets) ||
    value.assets.length > 2000 ||
    !validateAsset(value.launchAsset,prefix) ||
    !value.assets.every(asset => validateAsset(asset,prefix)) ||
    !value.extra || typeof value.extra !== 'object' || Array.isArray(value.extra) ||
    !('expoClient' in (value.extra as Record<string, unknown>))) return false;
  return true;
}

function loadManifest(channel: string, runtime: string) {
  const location = join(ROOT,'active',channel,runtime+'.json');
  if (!existsSync(location) || !lstatSync(location).isFile()) return null;
  if (statSync(location).size > 1024*1024) return null;
  try {
    const loaded = JSON.parse(readFileSync(location,'utf8')) as unknown;
    return validateExpoManifest(loaded,runtime,URL_PREFIX) ? loaded : null;
  } catch { return null; }
}

@Controller('mobile-updates/ota')
export class ExpoOtaController {
  @Get()
  manifest(
    @Headers('expo-protocol-version') protocol: string | undefined,
    @Headers('expo-platform') platform: string | undefined,
    @Headers('expo-runtime-version') runtime: string | undefined,
    @Headers('expo-channel-name') channel: string | undefined,
    @Headers('expo-expect-signature') expectSignature: string | undefined,
    @Res({passthrough:true}) response: ExpoResponse
  ) {
    if (!serviceEnabled()) {
      throw new ServiceUnavailableException('OTA désactivée : certificat ou configuration non installés.');
    }
    if (protocol !== '1' || platform !== 'android' ||
      !safeRuntime(runtime) || !CHANNEL.test(channel ?? '')) {
      throw new BadRequestException('Requête Expo OTA incompatible.');
    }
    // Refuse unsigned clients: OTA JS must always be verified with the embedded cert.
    if (!expectSignature || !expectSignature.includes('sig')) {
      throw new BadRequestException('Signature Expo obligatoire.');
    }
    const manifest = loadManifest(channel!,runtime!);
    if (!manifest) throw new NotFoundException('Aucune mise à jour compatible.');
    const payload = JSON.stringify(manifest);
    const key = readFileSync(KEY_PATH,'utf8');
    const signer = createSign('RSA-SHA256');
    signer.update(payload,'utf8');
    signer.end();
    const signature = signer.sign(key).toString('base64');
    response.setHeader('expo-protocol-version','1');
    response.setHeader('expo-sfv-version','0');
    response.setHeader('cache-control','private, max-age=0, no-store');
    response.setHeader('content-type','application/expo+json');
    response.setHeader('expo-signature',`sig=:${signature}:, keyid="main", alg="rsa-v1_5-sha256"`);
    return payload;
  }

  @Get('assets/:digest')
  asset(@Param('digest') digest:string,@Res({passthrough:true}) response:ExpoResponse) {
    if (!serviceEnabled() || !SHA.test(digest)) throw new NotFoundException();
    const location = join(ROOT,'assets',digest);
    if (!existsSync(location) || !lstatSync(location).isFile()) throw new NotFoundException();
    const size = statSync(location).size;
    if (size <= 0 || size > 80*1024*1024) throw new NotFoundException();
    response.setHeader('Cache-Control','public, max-age=31536000, immutable');
    response.setHeader('X-Content-Type-Options','nosniff');
    response.setHeader('Content-Length',String(size));
    const typePath = location + '.type';
    const allowed = new Set([
      'application/javascript', 'application/json', 'application/octet-stream',
      'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
      'font/ttf', 'font/otf', 'font/woff', 'font/woff2', 'audio/mpeg', 'audio/wav', 'video/mp4'
    ]);
    let type = 'application/octet-stream';
    if (existsSync(typePath) && lstatSync(typePath).isFile() && statSync(typePath).size < 80) {
      const recorded = readFileSync(typePath,'utf8');
      if (allowed.has(recorded)) type = recorded;
    }
    return new StreamableFile(createReadStream(location),{type,length:size});
  }
}
