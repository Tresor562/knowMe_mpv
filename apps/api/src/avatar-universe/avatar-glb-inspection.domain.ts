import { createHash } from 'crypto';
import { AvatarAssetManifest, AvatarLod, AVATAR_CANONICAL_SKELETON } from './avatar-asset-manifest.domain';

export type AvatarGlbInspection = {
  sha256:string; byteLength:number; triangles:number; vertices:number;
  meshes:number; primitives:number; materials:number; textures:number;
  joints:string[]; morphTargets:string[]; maxBonesPerVertex:number;
  cameras:number; lights:number; animations:number; skins:number;
  pbrMetallicRoughness:boolean;
};

const SHA256=/^[a-f0-9]{64}$/i;
export function sha256AvatarGlb(bytes:Uint8Array){return createHash('sha256').update(bytes).digest('hex');}

export function validateAvatarGlbInspection(manifest:AvatarAssetManifest,lod:AvatarLod,inspection:AvatarGlbInspection){
 if(!SHA256.test(inspection.sha256)||inspection.sha256.toLowerCase()!==lod.sha256.toLowerCase())throw new Error('Inspected GLB SHA-256 does not match the manifest.');
 if(inspection.byteLength!==lod.downloadBytes)throw new Error('Inspected GLB byte length does not match the manifest.');
 if(inspection.triangles!==lod.triangles||inspection.vertices!==lod.vertices)throw new Error('Inspected GLB geometry metrics do not match the manifest.');
 if(!Number.isSafeInteger(inspection.meshes)||inspection.meshes<1||!Number.isSafeInteger(inspection.primitives)||inspection.primitives<1)throw new Error('Runtime GLB must contain renderable mesh primitives.');
 if(inspection.cameras!==0||inspection.lights!==0)throw new Error('Runtime avatar GLB must not embed cameras or lights.');
 if(inspection.pbrMetallicRoughness!==true)throw new Error('Runtime avatar GLB must use PBR metallic-roughness materials.');
 if(manifest.geometry?.skinned){if(inspection.skins<1)throw new Error('Skinned avatar GLB must contain a skin.');if(inspection.maxBonesPerVertex>4)throw new Error('Avatar GLB exceeds 4 bone influences per vertex.');if(inspection.joints.length===0)throw new Error('Skinned avatar GLB must expose joints.');}
 if(manifest.skeletonKey===AVATAR_CANONICAL_SKELETON&&manifest.geometry?.skinned&&inspection.joints.length<15)throw new Error('Avatar GLB skeleton inspection is incomplete.');
 const expected=new Set(manifest.morphTargets);const actual=new Set(inspection.morphTargets);for(const morph of expected)if(!actual.has(morph))throw new Error(`Avatar GLB is missing declared morph target ${morph}.`);for(const morph of actual)if(!expected.has(morph))throw new Error(`Avatar GLB contains undeclared morph target ${morph}.`);
 return inspection;
}
