import {
  HERO_BLOCKOUT_REPORT_VERSION as V11_REPORT_VERSION,
  HERO_BLOCKOUT_ASSET_KEY,HERO_BLOCKOUT_BUDGETS,HERO_DNA_MORPH_NAMES,HERO_EXPRESSION_MORPH_NAMES,HERO_COMBINATION_CASE_NAMES,
  HeroBlockoutReport as HeroBlockoutReportV11,
  validateHeroBlockoutReport as validateV11,
} from './hero-blockout-report-v11.domain';

export const HERO_BLOCKOUT_REPORT_VERSION = 12 as const;
export const HERO_LOD_LEVELS = [0,1,2] as const;
export const HERO_LOD_MAX_TRIANGLES = [60000,30000,12000] as const;
export const HERO_LOD_MIN_REDUCTION_FROM_PREVIOUS = [0,0.25,0.50] as const;
export type HeroLodMetric={level:number;objectName:string;vertices:number;triangles:number;maxBonesPerVertex:number;reductionFromPrevious:number};
export type HeroBlockoutReport=Omit<HeroBlockoutReportV11,'reportVersion'>&{
 reportVersion:typeof HERO_BLOCKOUT_REPORT_VERSION;lodsVerified:true;lodCanonicalArmatureName:string;lodShapeKeyNames:string[];lodMetrics:HeroLodMetric[];
};
const V12_KEYS=new Set(['lodsVerified','lodCanonicalArmatureName','lodShapeKeyNames','lodMetrics']);
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const positiveInt=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;

export function validateHeroBlockoutReport(input:HeroBlockoutReport):HeroBlockoutReport{
 if(typeof input!=='object'||input===null||Array.isArray(input))throw new Error('Hero blockout report must be an object.');
 if(input.reportVersion!==HERO_BLOCKOUT_REPORT_VERSION)throw new Error('Unsupported Hero blockout report version.');
 const projected:Record<string,unknown>={};for(const [k,v] of Object.entries(input))if(!V12_KEYS.has(k))projected[k]=v;projected.reportVersion=V11_REPORT_VERSION;validateV11(projected as HeroBlockoutReportV11);
 if(input.lodsVerified!==true)throw new Error('Hero LOD evidence is missing or unverified.');
 if(typeof input.lodCanonicalArmatureName!=='string'||!input.lodCanonicalArmatureName.trim())throw new Error('Hero LOD armature evidence is invalid.');
 const expectedMorphs=[...HERO_DNA_MORPH_NAMES,...HERO_EXPRESSION_MORPH_NAMES];
 if(!Array.isArray(input.lodShapeKeyNames)||input.lodShapeKeyNames.length!==expectedMorphs.length+1||input.lodShapeKeyNames[0]!=='Basis'||expectedMorphs.some((n,i)=>input.lodShapeKeyNames[i+1]!==n))throw new Error('Hero LOD shape-key contract is non-canonical.');
 if(!Array.isArray(input.lodMetrics)||input.lodMetrics.length!==3)throw new Error('Hero requires exactly LOD0, LOD1 and LOD2 evidence.');
 input.lodMetrics.forEach((lod,index)=>{if(!lod||lod.level!==index||lod.objectName!==`BODY_LOD${index}`)throw new Error('Hero LOD identity is non-canonical.');if(!positiveInt(lod.vertices)||!positiveInt(lod.triangles)||lod.triangles>HERO_LOD_MAX_TRIANGLES[index])throw new Error('Hero LOD geometry metrics are invalid.');if(!Number.isSafeInteger(lod.maxBonesPerVertex)||lod.maxBonesPerVertex<0||lod.maxBonesPerVertex>4)throw new Error('Hero LOD skinning exceeds mobile influence budget.');if(!finite(lod.reductionFromPrevious)||lod.reductionFromPrevious<0||lod.reductionFromPrevious>=1)throw new Error('Hero LOD reduction evidence is invalid.');if(index===0&&lod.reductionFromPrevious!==0)throw new Error('LOD0 cannot claim reduction.');if(index>0){const prev=input.lodMetrics[index-1].triangles;if(lod.triangles>=prev)throw new Error('Hero LOD triangle counts must strictly decrease.');const measured=1-lod.triangles/prev;if(measured+1e-6<HERO_LOD_MIN_REDUCTION_FROM_PREVIOUS[index]||Math.abs(measured-lod.reductionFromPrevious)>1e-5)throw new Error('Hero LOD reduction evidence does not match geometry.');}});
 return input;
}
export {HERO_BLOCKOUT_ASSET_KEY,HERO_BLOCKOUT_BUDGETS,HERO_DNA_MORPH_NAMES,HERO_EXPRESSION_MORPH_NAMES,HERO_COMBINATION_CASE_NAMES};
