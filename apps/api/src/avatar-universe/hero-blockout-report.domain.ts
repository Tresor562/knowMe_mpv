import { AVATAR_CANONICAL_SKELETON } from './avatar-asset-manifest.domain';

export const HERO_BLOCKOUT_REPORT_VERSION = 2 as const;
export const HERO_BLOCKOUT_REQUIRED_OBJECTS = ['BODY','EYE_L','EYE_R'] as const;
export const HERO_BLOCKOUT_OPTIONAL_OBJECTS = ['TEETH','TONGUE','HAIR_PLACEHOLDER'] as const;
export const HERO_BLOCKOUT_ALLOWED_OBJECTS = [...HERO_BLOCKOUT_REQUIRED_OBJECTS,...HERO_BLOCKOUT_OPTIONAL_OBJECTS] as const;
export type HeroBlockoutObjectRole = typeof HERO_BLOCKOUT_ALLOWED_OBJECTS[number];
export type HeroBlockoutObjectReport = { role:HeroBlockoutObjectRole; vertices:number; triangles:number; manifold:boolean; unappliedTransforms:boolean; fusedClothingOrAccessories:boolean; };
export type HeroBlockoutReport = {
 reportVersion:typeof HERO_BLOCKOUT_REPORT_VERSION;
 assetKey:string;
 unitSystem:'METERS';
 authoringUpAxis:'Z';
 runtimeUpAxis:'Y';
 pose:'A_POSE';
 centeredWorldOrigin:true;
 measuredBodyCenterX:number;
 groundContactY:0;
 measuredGroundContactMeters:number;
 groundContactVerified:true;
 bodyHeightMeters:number;
 skeletonTarget:typeof AVATAR_CANONICAL_SKELETON;
 stableVertexOrder:true;
 deformationTopologyReady:boolean;
 objects:HeroBlockoutObjectReport[];
};

const SAFE_KEY=/^[a-z0-9][a-z0-9._-]{1,95}$/i;
const HERO_BLOCKOUT_ALLOWED_ROLE_SET=new Set<string>(HERO_BLOCKOUT_ALLOWED_OBJECTS);
export const HERO_BLOCKOUT_BUDGETS=Object.freeze({minHeightMeters:1.35,maxHeightMeters:2.15,maxBodyTriangles:60000,maxBodyVertices:45000,maxTotalTriangles:75000,maxCenterOffsetMeters:0.002,maxGroundOffsetMeters:0.002});

export function validateHeroBlockoutReport(input:HeroBlockoutReport):HeroBlockoutReport{
 if(input.reportVersion!==HERO_BLOCKOUT_REPORT_VERSION)throw new Error('Unsupported Hero blockout report version.');
 if(!SAFE_KEY.test(input.assetKey))throw new Error('Invalid Hero blockout asset key.');
 if(input.unitSystem!=='METERS'||input.authoringUpAxis!=='Z'||input.runtimeUpAxis!=='Y'||input.pose!=='A_POSE'||input.centeredWorldOrigin!==true||input.groundContactY!==0)throw new Error('Hero blockout transform convention is invalid.');
 if(input.groundContactVerified!==true||!Number.isFinite(input.measuredGroundContactMeters)||Math.abs(input.measuredGroundContactMeters)>HERO_BLOCKOUT_BUDGETS.maxGroundOffsetMeters)throw new Error('Hero blockout ground contact must be measured within tolerance.');
 if(!Number.isFinite(input.measuredBodyCenterX)||Math.abs(input.measuredBodyCenterX)>HERO_BLOCKOUT_BUDGETS.maxCenterOffsetMeters)throw new Error('Hero blockout body must be measurably centered on the world X axis.');
 if(input.skeletonTarget!==AVATAR_CANONICAL_SKELETON)throw new Error('Hero blockout must target the canonical skeleton.');
 if(!Number.isFinite(input.bodyHeightMeters)||input.bodyHeightMeters<HERO_BLOCKOUT_BUDGETS.minHeightMeters||input.bodyHeightMeters>HERO_BLOCKOUT_BUDGETS.maxHeightMeters)throw new Error('Hero blockout body height is outside the supported human range.');
 if(input.stableVertexOrder!==true)throw new Error('Hero blockout vertex order must be locked before DNA morph production.');
 if(input.deformationTopologyReady!==true)throw new Error('Hero blockout requires deformation-ready topology around major joints and face loops.');
 if(!Array.isArray(input.objects)||input.objects.length<3)throw new Error('Hero blockout object report is incomplete.');
 const roles=input.objects.map(o=>o.role as string);
 for(const role of roles)if(!HERO_BLOCKOUT_ALLOWED_ROLE_SET.has(role))throw new Error(`Hero blockout contains unsupported object role ${role}.`);
 if(new Set(roles).size!==roles.length)throw new Error('Hero blockout object roles must be unique.');
 for(const role of HERO_BLOCKOUT_REQUIRED_OBJECTS)if(!roles.includes(role))throw new Error(`Hero blockout is missing required object ${role}.`);
 let totalTriangles=0;
 for(const object of input.objects){if(!Number.isSafeInteger(object.vertices)||object.vertices<=0||!Number.isSafeInteger(object.triangles)||object.triangles<=0)throw new Error('Hero blockout contains invalid mesh metrics.');if(object.manifold!==true)throw new Error(`${object.role} contains non-manifold geometry.`);if(object.unappliedTransforms)throw new Error(`${object.role} has unapplied transforms.`);if(object.fusedClothingOrAccessories)throw new Error(`${object.role} contains fused clothing/accessory geometry.`);totalTriangles+=object.triangles;if(object.role==='BODY'&&(object.triangles>HERO_BLOCKOUT_BUDGETS.maxBodyTriangles||object.vertices>HERO_BLOCKOUT_BUDGETS.maxBodyVertices))throw new Error('Hero body exceeds the blockout geometry budget.');}
 if(totalTriangles>HERO_BLOCKOUT_BUDGETS.maxTotalTriangles)throw new Error('Hero blockout exceeds the total geometry budget.');
 return input;
}
