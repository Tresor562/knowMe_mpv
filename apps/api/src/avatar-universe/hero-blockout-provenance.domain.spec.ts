import { HERO_BLOCKOUT_ASSET_KEY, HERO_BLOCKOUT_REPORT_VERSION, HeroBlockoutReport } from './hero-blockout-report.domain';
import { AVATAR_CANONICAL_SKELETON } from './avatar-asset-manifest.domain';
import { HERO_BLOCKOUT_PROVENANCE_VERSION, HeroBlockoutProvenance, sha256Hex, validateHeroBlockoutProvenance, verifyHeroBlockoutSource } from './hero-blockout-provenance.domain';

const report=():HeroBlockoutReport=>({reportVersion:HERO_BLOCKOUT_REPORT_VERSION,assetKey:HERO_BLOCKOUT_ASSET_KEY,unitSystem:'METERS',authoringUpAxis:'Z',runtimeUpAxis:'Y',pose:'A_POSE',poseVerified:true,measuredLeftUpperArmAngleDeg:40,measuredRightUpperArmAngleDeg:40,centeredWorldOrigin:true,measuredBodyCenterX:0,groundContactY:0,measuredGroundContactMeters:0,groundContactVerified:true,bodyHeightMeters:1.68,skeletonTarget:AVATAR_CANONICAL_SKELETON,stableVertexOrder:true,deformationTopologyReady:true,skinningVerified:true,measuredUnweightedBodyVertices:0,measuredMaxBodyBoneInfluences:4,measuredMaxBodyWeightSumError:0.001,uvVerified:true,measuredBodyUvLayers:1,measuredBodyUvOutOfBoundsLoops:0,pbrMaterialsVerified:true,measuredMaterialSlots:3,measuredMaxMaterialsPerObject:1,texturesVerified:true,bodyBaseColorTextureVerified:true,bodyNormalTextureVerified:true,bodyOrmTextureVerified:true,textureColorSpacesVerified:true,measuredTextureCount:3,measuredMaxTextureDimension:2048,measuredTotalTexturePixels:12582912,objects:[{role:'BODY',vertices:30000,triangles:45000,manifold:true,unappliedTransforms:false,fusedClothingOrAccessories:false},{role:'EYE_L',vertices:800,triangles:1400,manifold:true,unappliedTransforms:false,fusedClothingOrAccessories:false},{role:'EYE_R',vertices:800,triangles:1400,manifold:true,unappliedTransforms:false,fusedClothingOrAccessories:false}]});
const bytes=Buffer.from('real-hero-blockout-binary-fixture');
const valid=():HeroBlockoutProvenance=>({version:HERO_BLOCKOUT_PROVENANCE_VERSION,report:report(),sourceFormat:'GLB',sourceSha256:sha256Hex(bytes),exporter:'Blender 4.x KnowMe exporter',exportedAt:'2026-09-18T07:00:00.000Z'});

describe('Hero blockout source provenance gate',()=>{
  it('accepts a valid measured v8 report bound to source bytes',()=>expect(verifyHeroBlockoutSource(bytes,valid())).toBeDefined());
  it('rejects a forged digest',()=>{const x=valid();x.sourceSha256='0'.repeat(64);expect(()=>verifyHeroBlockoutSource(bytes,x)).toThrow(/digest mismatch/);});
  it('rejects malformed digests',()=>{const x=valid();x.sourceSha256='ABC';expect(()=>validateHeroBlockoutProvenance(x)).toThrow(/SHA-256/);});
  it('rejects unsupported source formats',()=>{const x=valid() as any;x.sourceFormat='PNG';expect(()=>validateHeroBlockoutProvenance(x)).toThrow(/source format/);});
  it('revalidates the embedded geometry report',()=>{const x=valid();x.report.objects[0].manifold=false;expect(()=>validateHeroBlockoutProvenance(x)).toThrow(/non-manifold/);});
  it('revalidates embedded Android texture evidence',()=>{const x=valid();x.report.measuredMaxTextureDimension=4096;expect(()=>validateHeroBlockoutProvenance(x)).toThrow(/texture budget/);});
  it('revalidates embedded PBR map semantics',()=>{const x=valid();x.report.bodyOrmTextureVerified=false as true;expect(()=>validateHeroBlockoutProvenance(x)).toThrow(/PBR texture evidence/);});
  it('rejects non-canonical timestamps',()=>{const x=valid();x.exportedAt='2026-09-18 07:00:00';expect(()=>validateHeroBlockoutProvenance(x)).toThrow(/ISO-8601/);});
});
