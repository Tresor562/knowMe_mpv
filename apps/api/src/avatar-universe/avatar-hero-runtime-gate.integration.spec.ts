import { describe, expect, it } from 'vitest';
import {
  AVATAR_BODY_MORPHS,
  AVATAR_FACE_MORPHS,
  AVATAR_CANONICAL_FACIAL_RIG,
  AVATAR_CANONICAL_SKELETON,
  AvatarAssetManifest,
  validateAvatarAssetManifest,
} from './avatar-asset-manifest.domain';
import { AVATAR_EXPRESSION_BLENDSHAPES } from './avatar-facial-expression.domain';
import { AvatarGlbInspection, validateAvatarGlbInspection } from './avatar-glb-inspection.domain';

const HASH='a'.repeat(64);
const heroManifest=():AvatarAssetManifest=>({
  manifestVersion:1,
  assetKey:'knowme.hero.base-body.v1',
  kind:'BASE_BODY',
  format:'GLB',
  skeletonKey:AVATAR_CANONICAL_SKELETON,
  facialRigKey:AVATAR_CANONICAL_FACIAL_RIG,
  materialProfileKey:'knowme.pbr.mobile.v1',
  morphTargets:[...AVATAR_BODY_MORPHS,...AVATAR_FACE_MORPHS],
  geometry:{skinned:true,maxBonesPerVertex:4},
  lods:[
    {level:0,uri:'https://cdn.knowme.test/hero-lod0.glb',triangles:52000,vertices:30000,downloadBytes:7_000_000,sha256:HASH},
    {level:1,uri:'https://cdn.knowme.test/hero-lod1.glb',triangles:28000,vertices:17000,downloadBytes:4_000_000,sha256:'b'.repeat(64)},
    {level:2,uri:'https://cdn.knowme.test/hero-lod2.glb',triangles:11000,vertices:7000,downloadBytes:2_000_000,sha256:'c'.repeat(64)},
  ],
  textures:{baseColor:'asset://hero-base',normal:'asset://hero-normal',maxResolution:2048},
  provenance:{sourceRevision:'hero-src-v1',exportRevision:'hero-export-v1',exporter:'blender',exporterVersion:'4.3',skeletonVersion:AVATAR_CANONICAL_SKELETON,validatedAt:'2026-09-22T20:00:00Z'},
  pbr:true,
  originalDesign:true,
});

const heroInspection=():AvatarGlbInspection=>({
  sha256:HASH,byteLength:7_000_000,triangles:52000,vertices:30000,meshes:2,primitives:2,materials:2,textures:2,
  joints:Array.from({length:55},(_,i)=>`joint_${i}`),
  morphTargets:[...AVATAR_BODY_MORPHS,...AVATAR_FACE_MORPHS,...AVATAR_EXPRESSION_BLENDSHAPES],
  maxBonesPerVertex:4,cameras:0,lights:0,animations:1,skins:1,pbrMetallicRoughness:true,hasNormals:true,hasTangents:true,hasUv0:true,
  invalidNumericData:false,normalizedSkinWeights:true,textureReferencesValid:true,embeddedImages:true,externalImages:0,normalMappedMaterials:2,
  unsupportedTextureExtensions:[],maxTextureWidth:2048,maxTextureHeight:2048,textureGpuBytes:22_369_620,textureEncodedBytes:1_400_000,
  textureMipChainsComplete:true,textureColorSpacesValid:true,textureColorSpaceIssues:[],srgbTextureCount:1,linearTextureCount:1,
  textureSamplersValid:true,textureSamplerIssues:[],mipmappedSamplerCount:2,repeatSamplerCount:2,
  rigValid:true,rigIssues:[],rigRootCount:1,skinnedNodeCount:2,
  animationsValid:true,animationIssues:[],animationChannelCount:1,animatedNodeCount:1,rotationChannelCount:0,morphWeightChannelCount:1,
  animationBinaryValid:true,animationBinaryIssues:[],animationKeyframeCount:2,maxAnimationClipDurationSeconds:.5,nonFiniteAnimationValueCount:0,nonNormalizedQuaternionCount:0,
  facialValid:true,facialIssues:[],expressionTargets:[...AVATAR_EXPRESSION_BLENDSHAPES],expressionMeshIndices:[0],expressionTargetCount:AVATAR_EXPRESSION_BLENDSHAPES.length,facialWeightChannelCount:1,
});

describe('Hero BASE_BODY runtime certification gate',()=>{
  it('accepts a Hero contract carrying DNA and certified facial expressions together',()=>{
    const manifest=validateAvatarAssetManifest(heroManifest());
    const inspection=heroInspection();
    expect(validateAvatarGlbInspection(manifest,manifest.lods[0],inspection)).toBe(inspection);
  });

  it('fails closed when the Hero facial animation proof is missing',()=>{
    const manifest=validateAvatarAssetManifest(heroManifest());
    const inspection=heroInspection(); inspection.facialWeightChannelCount=0;
    expect(()=>validateAvatarGlbInspection(manifest,manifest.lods[0],inspection)).toThrow(/weights animation channel/);
  });

  it('fails closed when an expression morph exists but is not part of the certified expression set',()=>{
    const manifest=validateAvatarAssetManifest(heroManifest());
    const inspection=heroInspection(); inspection.expressionTargets=inspection.expressionTargets!.slice(1);
    expect(()=>validateAvatarGlbInspection(manifest,manifest.lods[0],inspection)).toThrow(/missing canonical expression target/);
  });

  it('does not allow undeclared non-expression morphs to hide beside certified facial targets',()=>{
    const manifest=validateAvatarAssetManifest(heroManifest());
    const inspection=heroInspection(); inspection.morphTargets.push('clientInjectedMorph');
    expect(()=>validateAvatarGlbInspection(manifest,manifest.lods[0],inspection)).toThrow(/undeclared morph target/);
  });
});
