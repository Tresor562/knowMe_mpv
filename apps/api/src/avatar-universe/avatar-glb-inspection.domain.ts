import { createHash } from 'crypto';
import { AvatarAssetManifest, AvatarLod, AVATAR_CANONICAL_SKELETON, AVATAR_MOBILE_ASSET_BUDGETS } from './avatar-asset-manifest.domain';

export type AvatarGlbInspection = {
  sha256:string; byteLength:number; triangles:number; vertices:number;
  meshes:number; primitives:number; materials:number; textures:number;
  joints:string[]; morphTargets:string[]; maxBonesPerVertex:number;
  cameras:number; lights:number; animations:number; skins:number;
  pbrMetallicRoughness:boolean;
  hasNormals:boolean; hasTangents:boolean; hasUv0:boolean;
  invalidNumericData:boolean; normalizedSkinWeights:boolean;
  textureReferencesValid:boolean; embeddedImages:boolean; externalImages:number;
  normalMappedMaterials:number; unsupportedTextureExtensions:string[];
  maxTextureWidth?:number; maxTextureHeight?:number; textureGpuBytes?:number;
  textureEncodedBytes?:number; textureMipChainsComplete?:boolean;
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
 if(!inspection.hasNormals)throw new Error('Runtime avatar GLB must provide NORMAL attributes.');
 if(!inspection.hasUv0)throw new Error('Runtime avatar GLB must provide TEXCOORD_0 attributes.');
 if(inspection.normalMappedMaterials>0&&!inspection.hasTangents)throw new Error('Normal-mapped runtime avatar GLB must provide TANGENT attributes.');
 if(!inspection.textureReferencesValid)throw new Error('Runtime avatar GLB contains invalid texture/image references.');
 if(inspection.externalImages>0||!inspection.embeddedImages)throw new Error('Runtime avatar GLB textures must be embedded in the GLB.');
 if(inspection.unsupportedTextureExtensions.length)throw new Error(`Runtime avatar GLB uses unsupported texture extensions: ${inspection.unsupportedTextureExtensions.join(', ')}.`);
 const maxResolution=Math.min(manifest.textures.maxResolution,AVATAR_MOBILE_ASSET_BUDGETS.maxTextureResolution);
 if(!Number.isSafeInteger(inspection.maxTextureWidth)||!Number.isSafeInteger(inspection.maxTextureHeight)||(inspection.maxTextureWidth??0)<1||(inspection.maxTextureHeight??0)<1)throw new Error('Runtime avatar GLB texture dimensions were not inspected from embedded image bytes.');
 if((inspection.maxTextureWidth??0)>maxResolution||(inspection.maxTextureHeight??0)>maxResolution)throw new Error(`Runtime avatar GLB texture exceeds certified ${maxResolution}px resolution.`);
 if(!Number.isSafeInteger(inspection.textureGpuBytes)||(inspection.textureGpuBytes??0)<1)throw new Error('Runtime avatar GLB texture GPU budget was not derived from embedded image bytes.');
 if(!Number.isSafeInteger(inspection.textureEncodedBytes)||(inspection.textureEncodedBytes??0)<1||(inspection.textureEncodedBytes??0)>inspection.byteLength)throw new Error('Runtime avatar GLB embedded texture byte accounting is invalid.');
 if(lod.level>0&&inspection.textureMipChainsComplete!==true)throw new Error('Mobile LOD1/LOD2 avatar textures require complete mip chains.');
 if(inspection.invalidNumericData)throw new Error('Runtime avatar GLB contains non-finite vertex data.');
 if(manifest.geometry?.skinned){if(inspection.skins<1)throw new Error('Skinned avatar GLB must contain a skin.');if(inspection.maxBonesPerVertex>4)throw new Error('Avatar GLB exceeds 4 non-zero bone influences per vertex.');if(inspection.joints.length===0)throw new Error('Skinned avatar GLB must expose joints.');if(!inspection.normalizedSkinWeights)throw new Error('Avatar GLB skin weights must be normalized per vertex.');}
 if(manifest.skeletonKey===AVATAR_CANONICAL_SKELETON&&manifest.geometry?.skinned&&inspection.joints.length<15)throw new Error('Avatar GLB skeleton inspection is incomplete.');
 const expected=new Set(manifest.morphTargets);const actual=new Set(inspection.morphTargets);for(const morph of expected)if(!actual.has(morph))throw new Error(`Avatar GLB is missing declared morph target ${morph}.`);for(const morph of actual)if(!expected.has(morph))throw new Error(`Avatar GLB contains undeclared morph target ${morph}.`);
 return inspection;
}
