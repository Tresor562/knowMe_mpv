import { AVATAR_RENDER_TIERS, AvatarRenderTier } from './avatar-universe.domain';

export const AVATAR_RENDER_PROFILE_SCHEMA_VERSION = 1 as const;
export const AVATAR_RENDER_BACKENDS = ['WEBGL2', 'VULKAN_ANDROID'] as const;
export const AVATAR_TONE_MAPPERS = ['ACES'] as const;
export const AVATAR_ENVIRONMENTS = ['STUDIO_NEUTRAL_V1'] as const;

export type AvatarRenderBackend = (typeof AVATAR_RENDER_BACKENDS)[number];
export type AvatarToneMapper = (typeof AVATAR_TONE_MAPPERS)[number];
export type AvatarEnvironment = (typeof AVATAR_ENVIRONMENTS)[number];

export type AvatarRenderProfile = {
  schemaVersion: typeof AVATAR_RENDER_PROFILE_SCHEMA_VERSION;
  key: string;
  tier: AvatarRenderTier;
  backend: AvatarRenderBackend;
  pbr: {
    metallicRoughness: true;
    normalMapping: true;
    occlusion: true;
    imageBasedLighting: true;
    toneMapper: AvatarToneMapper;
    maxDynamicLights: number;
  };
  turntable: {
    enabled: true;
    degrees: 360;
    framesPerRevolution: number;
    autoRotateSeconds: number;
    dragDegreesPerViewport: number;
  };
  camera: {
    verticalFovDegrees: number;
    nearMeters: number;
    farMeters: number;
    targetHeightRatio: number;
  };
  environment: AvatarEnvironment;
  android: {
    maxGpuFrameMs: number;
    maxDrawCalls: number;
    maxVisibleTriangles: number;
    maxTextureMemoryMiB: number;
    maxSkinnedMeshes: number;
    maxBonesPerDraw: number;
    textureCompression: 'KTX2_BASISU';
  };
};

const PROFILE_KEYS = new Set([
  'schemaVersion', 'key', 'tier', 'backend', 'pbr', 'turntable', 'camera', 'environment', 'android'
]);
const PBR_KEYS = new Set(['metallicRoughness', 'normalMapping', 'occlusion', 'imageBasedLighting', 'toneMapper', 'maxDynamicLights']);
const TURNTABLE_KEYS = new Set(['enabled', 'degrees', 'framesPerRevolution', 'autoRotateSeconds', 'dragDegreesPerViewport']);
const CAMERA_KEYS = new Set(['verticalFovDegrees', 'nearMeters', 'farMeters', 'targetHeightRatio']);
const ANDROID_KEYS = new Set(['maxGpuFrameMs', 'maxDrawCalls', 'maxVisibleTriangles', 'maxTextureMemoryMiB', 'maxSkinnedMeshes', 'maxBonesPerDraw', 'textureCompression']);

const TIER_LIMITS: Record<AvatarRenderTier, AvatarRenderProfile['android']> = {
  LAYERED_2D: { maxGpuFrameMs:16.67,maxDrawCalls:24,maxVisibleTriangles:0,maxTextureMemoryMiB:32,maxSkinnedMeshes:0,maxBonesPerDraw:0,textureCompression:'KTX2_BASISU' },
  REALTIME_3D_BALANCED: { maxGpuFrameMs:16.67,maxDrawCalls:70,maxVisibleTriangles:90_000,maxTextureMemoryMiB:128,maxSkinnedMeshes:12,maxBonesPerDraw:96,textureCompression:'KTX2_BASISU' },
  REALTIME_3D_HIGH: { maxGpuFrameMs:16.67,maxDrawCalls:110,maxVisibleTriangles:160_000,maxTextureMemoryMiB:192,maxSkinnedMeshes:16,maxBonesPerDraw:128,textureCompression:'KTX2_BASISU' },
  CINEMATIC_PREVIEW: { maxGpuFrameMs:33.34,maxDrawCalls:180,maxVisibleTriangles:300_000,maxTextureMemoryMiB:320,maxSkinnedMeshes:20,maxBonesPerDraw:128,textureCompression:'KTX2_BASISU' }
};

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function exact(source: Record<string, unknown>, allowed: ReadonlySet<string>, label: string) {
  for (const key of Object.keys(source)) if (!allowed.has(key)) throw new Error(`Unknown ${label} field: ${key}`);
  for (const key of allowed) if (!(key in source)) throw new Error(`Missing ${label} field: ${key}`);
}
function number(value: unknown, label: string, min: number, max: number, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) throw new Error(`${label} is outside the certified range`);
  return value;
}
function literalTrue(value: unknown, label: string): true { if (value !== true) throw new Error(`${label} must be enabled`); return true; }

export function validateAvatarRenderProfile(value: unknown): AvatarRenderProfile {
  const source=object(value,'render profile'); exact(source,PROFILE_KEYS,'render profile');
  if(source.schemaVersion!==AVATAR_RENDER_PROFILE_SCHEMA_VERSION) throw new Error('Unsupported render profile schema version');
  if(typeof source.key!=='string'||!/^[a-z0-9][a-z0-9._-]{2,79}$/i.test(source.key)) throw new Error('render profile key is invalid');
  if(!AVATAR_RENDER_TIERS.includes(source.tier as never)) throw new Error('render tier is invalid');
  if(!AVATAR_RENDER_BACKENDS.includes(source.backend as never)) throw new Error('render backend is invalid');
  if(!AVATAR_ENVIRONMENTS.includes(source.environment as never)) throw new Error('render environment is invalid');

  const pbr=object(source.pbr,'pbr'); exact(pbr,PBR_KEYS,'pbr');
  const turntable=object(source.turntable,'turntable'); exact(turntable,TURNTABLE_KEYS,'turntable');
  const camera=object(source.camera,'camera'); exact(camera,CAMERA_KEYS,'camera');
  const android=object(source.android,'android'); exact(android,ANDROID_KEYS,'android');
  const tier=source.tier as AvatarRenderTier;
  const limits=TIER_LIMITS[tier];

  literalTrue(pbr.metallicRoughness,'PBR metallic-roughness'); literalTrue(pbr.normalMapping,'PBR normal mapping'); literalTrue(pbr.occlusion,'PBR occlusion'); literalTrue(pbr.imageBasedLighting,'PBR image based lighting');
  if(!AVATAR_TONE_MAPPERS.includes(pbr.toneMapper as never)) throw new Error('tone mapper is not certified');
  number(pbr.maxDynamicLights,'maxDynamicLights',0,4,true);
  literalTrue(turntable.enabled,'360 turntable'); if(turntable.degrees!==360) throw new Error('turntable must cover exactly 360 degrees');
  number(turntable.framesPerRevolution,'framesPerRevolution',60,720,true); number(turntable.autoRotateSeconds,'autoRotateSeconds',4,30); number(turntable.dragDegreesPerViewport,'dragDegreesPerViewport',90,720);
  number(camera.verticalFovDegrees,'verticalFovDegrees',25,60); number(camera.nearMeters,'nearMeters',0.01,0.2); number(camera.farMeters,'farMeters',3,20); number(camera.targetHeightRatio,'targetHeightRatio',0.35,0.7);
  if((camera.nearMeters as number)>=(camera.farMeters as number)) throw new Error('camera clipping range is invalid');

  if(android.textureCompression!=='KTX2_BASISU') throw new Error('Android runtime textures must use KTX2/BasisU');
  number(android.maxGpuFrameMs,'maxGpuFrameMs',1,limits.maxGpuFrameMs); number(android.maxDrawCalls,'maxDrawCalls',0,limits.maxDrawCalls,true); number(android.maxVisibleTriangles,'maxVisibleTriangles',0,limits.maxVisibleTriangles,true); number(android.maxTextureMemoryMiB,'maxTextureMemoryMiB',1,limits.maxTextureMemoryMiB,true); number(android.maxSkinnedMeshes,'maxSkinnedMeshes',0,limits.maxSkinnedMeshes,true); number(android.maxBonesPerDraw,'maxBonesPerDraw',0,limits.maxBonesPerDraw,true);
  if(tier==='LAYERED_2D' && (android.maxVisibleTriangles!==0||android.maxSkinnedMeshes!==0||android.maxBonesPerDraw!==0)) throw new Error('LAYERED_2D cannot declare 3D skinning budgets');

  return {
    schemaVersion:AVATAR_RENDER_PROFILE_SCHEMA_VERSION,key:source.key as string,tier,backend:source.backend as AvatarRenderBackend,
    pbr:{metallicRoughness:true,normalMapping:true,occlusion:true,imageBasedLighting:true,toneMapper:pbr.toneMapper as AvatarToneMapper,maxDynamicLights:pbr.maxDynamicLights as number},
    turntable:{enabled:true,degrees:360,framesPerRevolution:turntable.framesPerRevolution as number,autoRotateSeconds:turntable.autoRotateSeconds as number,dragDegreesPerViewport:turntable.dragDegreesPerViewport as number},
    camera:{verticalFovDegrees:camera.verticalFovDegrees as number,nearMeters:camera.nearMeters as number,farMeters:camera.farMeters as number,targetHeightRatio:camera.targetHeightRatio as number},
    environment:source.environment as AvatarEnvironment,
    android:{maxGpuFrameMs:android.maxGpuFrameMs as number,maxDrawCalls:android.maxDrawCalls as number,maxVisibleTriangles:android.maxVisibleTriangles as number,maxTextureMemoryMiB:android.maxTextureMemoryMiB as number,maxSkinnedMeshes:android.maxSkinnedMeshes as number,maxBonesPerDraw:android.maxBonesPerDraw as number,textureCompression:'KTX2_BASISU'}
  };
}

export const AVATAR_BALANCED_RENDER_PROFILE: Readonly<AvatarRenderProfile> = Object.freeze({
  schemaVersion:1,key:'knowme.render.android-balanced.v1',tier:'REALTIME_3D_BALANCED',backend:'VULKAN_ANDROID',
  pbr:{metallicRoughness:true,normalMapping:true,occlusion:true,imageBasedLighting:true,toneMapper:'ACES',maxDynamicLights:2},
  turntable:{enabled:true,degrees:360,framesPerRevolution:180,autoRotateSeconds:10,dragDegreesPerViewport:360},
  camera:{verticalFovDegrees:40,nearMeters:0.05,farMeters:8,targetHeightRatio:0.52},environment:'STUDIO_NEUTRAL_V1',
  android:{maxGpuFrameMs:16.67,maxDrawCalls:70,maxVisibleTriangles:90_000,maxTextureMemoryMiB:128,maxSkinnedMeshes:12,maxBonesPerDraw:96,textureCompression:'KTX2_BASISU'}
});
