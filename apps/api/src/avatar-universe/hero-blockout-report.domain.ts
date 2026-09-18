import { AVATAR_CANONICAL_SKELETON } from './avatar-asset-manifest.domain';

export const HERO_BLOCKOUT_REPORT_VERSION = 4 as const;
export const HERO_BLOCKOUT_ASSET_KEY = 'knowme.hero.blockout.v1' as const;
export const HERO_BLOCKOUT_REQUIRED_OBJECTS = ['BODY','EYE_L','EYE_R'] as const;
export const HERO_BLOCKOUT_OPTIONAL_OBJECTS = ['TEETH','TONGUE','HAIR_PLACEHOLDER'] as const;
export const HERO_BLOCKOUT_ALLOWED_OBJECTS = [...HERO_BLOCKOUT_REQUIRED_OBJECTS,...HERO_BLOCKOUT_OPTIONAL_OBJECTS] as const;
export type HeroBlockoutObjectRole = typeof HERO_BLOCKOUT_ALLOWED_OBJECTS[number];
export type HeroBlockoutObjectReport = { role:HeroBlockoutObjectRole; vertices:number; triangles:number; manifold:boolean; unappliedTransforms:boolean; fusedClothingOrAccessories:boolean; };
export type HeroBlockoutReport = {
 reportVersion:typeof HERO_BLOCKOUT_REPORT_VERSION; assetKey:typeof HERO_BLOCKOUT_ASSET_KEY; unitSystem:'METERS'; authoringUpAxis:'Z'; runtimeUpAxis:'Y'; pose:'A_POSE'; poseVerified:true;
 measuredLeftUpperArmAngleDeg:number; measuredRightUpperArmAngleDeg:number; centeredWorldOrigin:true; measuredBodyCenterX:number; groundContactY:0; measuredGroundContactMeters:number; groundContactVerified:true; bodyHeightMeters:number; skeletonTarget:typeof AVATAR_CANONICAL_SKELETON; stableVertexOrder:true; deformationTopologyReady:boolean;
 skinningVerified:true; measuredUnweightedBodyVertices:0; measuredMaxBodyBoneInfluences:number; measuredMaxBodyWeightSumError:number; objects:HeroBlockoutObjectReport[];
};

const HERO_BLOCKOUT_ALLOWED_ROLE_SET=new Set<string>(HERO_BLOCKOUT_ALLOWED_OBJECTS);
const HERO_BLOCKOUT_REPORT_KEYS=new Set(['reportVersion','assetKey','unitSystem','authoringUpAxis','runtimeUpAxis','pose','poseVerified','measuredLeftUpperArmAngleDeg','measuredRightUpperArmAngleDeg','centeredWorldOrigin','measuredBodyCenterX','groundContactY','measuredGroundContactMeters','groundContactVerified','bodyHeightMeters','skeletonTarget','stableVertexOrder','deformationTopologyReady','skinningVerified','measuredUnweightedBodyVertices','measuredMaxBodyBoneInfluences','measuredMaxBodyWeightSumError','objects']);
const HERO_BLOCKOUT_OBJECT_KEYS=new Set(['role','vertices','triangles','manifold','unappliedTransforms','fusedClothingOrAccessories']);
export const HERO_BLOCKOUT_BUDGETS=Object.freeze({minHeightMeters:1.35,maxHeightMeters:2.15,maxBodyTriangles:60000,maxBodyVertices:45000,maxTotalTriangles:75000,maxCenterOffsetMeters:0.002,maxGroundOffsetMeters:0.002,minUpperArmAngleDeg:25,maxUpperArmAngleDeg:60,maxArmAngleAsymmetryDeg:8,maxBodyBoneInfluences:4,maxBodyWeightSumError:0.02});

function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
function assertExactKeys(value:Record<string,unknown>,allowed:Set<string>,scope:string):void{for(const key of Object.keys(value))if(!allowed.has(key))throw new Error(`${scope} contains unsupported field ${key}.`);}
function isFiniteNumber(value:unknown):value is number{return typeof value==='number'&&Number.isFinite(value);}

/** Runtime boundary: reports can originate from JSON, so never rely on TypeScript-only guarantees here. */
export function validateHeroBlockoutReport(input:HeroBlockoutReport):HeroBlockoutReport{
 if(!isRecord(input))throw new Error('Hero blockout report must be an object.');
 assertExactKeys(input,HERO_BLOCKOUT_REPORT_KEYS,'Hero blockout report');
 if(input.reportVersion!==HERO_BLOCKOUT_REPORT_VERSION)throw new Error('Unsupported Hero blockout report version.');
 if(input.assetKey!==HERO_BLOCKOUT_ASSET_KEY)throw new Error('Hero blockout asset key does not match the canonical Hero source.');
 if(input.unitSystem!=='METERS'||input.authoringUpAxis!=='Z'||input.runtimeUpAxis!=='Y'||input.pose!=='A_POSE'||input.centeredWorldOrigin!==true||input.groundContactY!==0)throw new Error('Hero blockout transform convention is invalid.');
 if(input.poseVerified!==true||!isFiniteNumber(input.measuredLeftUpperArmAngleDeg)||!isFiniteNumber(input.measuredRightUpperArmAngleDeg))throw new Error('Hero A-pose must include measured arm-angle evidence.');
 const left=input.measuredLeftUpperArmAngleDeg,right=input.measuredRightUpperArmAngleDeg;
 if(left<HERO_BLOCKOUT_BUDGETS.minUpperArmAngleDeg||left>HERO_BLOCKOUT_BUDGETS.maxUpperArmAngleDeg||right<HERO_BLOCKOUT_BUDGETS.minUpperArmAngleDeg||right>HERO_BLOCKOUT_BUDGETS.maxUpperArmAngleDeg||Math.abs(left-right)>HERO_BLOCKOUT_BUDGETS.maxArmAngleAsymmetryDeg)throw new Error('Hero measured arm angles do not satisfy the canonical A-pose.');
 if(input.groundContactVerified!==true||!isFiniteNumber(input.measuredGroundContactMeters)||Math.abs(input.measuredGroundContactMeters)>HERO_BLOCKOUT_BUDGETS.maxGroundOffsetMeters)throw new Error('Hero blockout ground contact must be measured within tolerance.');
 if(!isFiniteNumber(input.measuredBodyCenterX)||Math.abs(input.measuredBodyCenterX)>HERO_BLOCKOUT_BUDGETS.maxCenterOffsetMeters)throw new Error('Hero blockout body must be measurably centered on the world X axis.');
 if(input.skeletonTarget!==AVATAR_CANONICAL_SKELETON)throw new Error('Hero blockout must target the canonical skeleton.');
 if(!isFiniteNumber(input.bodyHeightMeters)||input.bodyHeightMeters<HERO_BLOCKOUT_BUDGETS.minHeightMeters||input.bodyHeightMeters>HERO_BLOCKOUT_BUDGETS.maxHeightMeters)throw new Error('Hero blockout body height is outside the supported human range.');
 if(input.stableVertexOrder!==true)throw new Error('Hero blockout vertex order must be locked before DNA morph production.');
 if(input.deformationTopologyReady!==true)throw new Error('Hero blockout requires deformation-ready topology around major joints and face loops.');
 if(input.skinningVerified!==true||input.measuredUnweightedBodyVertices!==0||typeof input.measuredMaxBodyBoneInfluences!=='number'||!Number.isSafeInteger(input.measuredMaxBodyBoneInfluences)||input.measuredMaxBodyBoneInfluences<1||input.measuredMaxBodyBoneInfluences>HERO_BLOCKOUT_BUDGETS.maxBodyBoneInfluences||!isFiniteNumber(input.measuredMaxBodyWeightSumError)||input.measuredMaxBodyWeightSumError<0||input.measuredMaxBodyWeightSumError>HERO_BLOCKOUT_BUDGETS.maxBodyWeightSumError)throw new Error('Hero BODY skinning evidence is missing or outside the mobile deformation budget.');
 if(!Array.isArray(input.objects)||input.objects.length<3)throw new Error('Hero blockout object report is incomplete.');
 const roles:string[]=[];
 for(const rawObject of input.objects as unknown[]){
  if(!isRecord(rawObject))throw new Error('Hero blockout contains an invalid object report.');
  assertExactKeys(rawObject,HERO_BLOCKOUT_OBJECT_KEYS,'Hero blockout object');
  const role=rawObject.role;
  if(typeof role!=='string'||!HERO_BLOCKOUT_ALLOWED_ROLE_SET.has(role))throw new Error(`Hero blockout contains unsupported object role ${String(role)}.`);
  roles.push(role);
  const vertices=rawObject.vertices,triangles=rawObject.triangles;
  if(typeof vertices!=='number'||!Number.isSafeInteger(vertices)||vertices<=0||typeof triangles!=='number'||!Number.isSafeInteger(triangles)||triangles<=0)throw new Error('Hero blockout contains invalid mesh metrics.');
  if(rawObject.manifold!==true)throw new Error(`${role} contains non-manifold geometry.`);
  if(rawObject.unappliedTransforms!==false)throw new Error(`${role} must explicitly prove applied transforms.`);
  if(rawObject.fusedClothingOrAccessories!==false)throw new Error(`${role} must explicitly prove no fused clothing/accessory geometry.`);
 }
 if(new Set(roles).size!==roles.length)throw new Error('Hero blockout object roles must be unique.');
 for(const role of HERO_BLOCKOUT_REQUIRED_OBJECTS)if(!roles.includes(role))throw new Error(`Hero blockout is missing required object ${role}.`);
 let totalTriangles=0;
 for(const object of input.objects){totalTriangles+=object.triangles;if(object.role==='BODY'&&(object.triangles>HERO_BLOCKOUT_BUDGETS.maxBodyTriangles||object.vertices>HERO_BLOCKOUT_BUDGETS.maxBodyVertices))throw new Error('Hero body exceeds the blockout geometry budget.');}
 if(totalTriangles>HERO_BLOCKOUT_BUDGETS.maxTotalTriangles)throw new Error('Hero blockout exceeds the total geometry budget.');
 return input;
}
