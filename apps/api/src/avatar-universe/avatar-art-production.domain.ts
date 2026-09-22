export const AVATAR_ART_PIPELINE_STAGES = [
  'CONCEPT_MULTI_ANGLE','SCULPT','RETOPOLOGY','UV','PBR_TEXTURE','RIG','MORPH_TARGETS','LOD','RUNTIME_EXPORT','RUNTIME_CERTIFICATION',
] as const;
export type AvatarArtPipelineStage = (typeof AVATAR_ART_PIPELINE_STAGES)[number];

export const AVATAR_HERO_REQUIRED_VIEWS = ['FRONT','BACK','LEFT','RIGHT','THREE_QUARTER_FRONT','THREE_QUARTER_BACK'] as const;
export type AvatarHeroReferenceView = (typeof AVATAR_HERO_REQUIRED_VIEWS)[number];

export const AVATAR_RUNTIME_SOURCE_FORMATS = ['BLEND','ZTL','FBX','USD'] as const;
export const AVATAR_RUNTIME_EXPORT_FORMATS = ['GLB'] as const;

export type AvatarArtEvidence = {
  sourceRevision:string;
  artistRevision:string;
  stage:AvatarArtPipelineStage;
  tool:string;
  toolVersion:string;
  reviewedAt:string;
  reviewer:string;
};

export type AvatarHeroArtPackage = {
  assetKey:string;
  originalDesign:true;
  referenceViews:Partial<Record<AvatarHeroReferenceView,string>>;
  sourceFormat:(typeof AVATAR_RUNTIME_SOURCE_FORMATS)[number];
  runtimeFormat:(typeof AVATAR_RUNTIME_EXPORT_FORMATS)[number];
  commonSkeletonKey:'knowme.humanoid.v1';
  facialRigKey:'knowme.face.v1';
  pbrWorkflow:'METALLIC_ROUGHNESS';
  hairTechnique:'HAIR_CARDS';
  stages:AvatarArtEvidence[];
};

const SAFE=/^[a-z0-9][a-z0-9._-]{1,95}$/i;
function assertKey(value:string,label:string){if(!SAFE.test(value))throw new Error(`Invalid ${label}.`);}

export function validateAvatarHeroArtPackage(input:AvatarHeroArtPackage){
  assertKey(input.assetKey,'Hero asset key');
  if(input.originalDesign!==true)throw new Error('Hero Avatar must be an original design.');
  if(input.runtimeFormat!=='GLB')throw new Error('Hero Avatar runtime export must be GLB.');
  if(input.commonSkeletonKey!=='knowme.humanoid.v1')throw new Error('Hero Avatar must use the canonical skeleton.');
  if(input.facialRigKey!=='knowme.face.v1')throw new Error('Hero Avatar must use the canonical facial rig.');
  if(input.pbrWorkflow!=='METALLIC_ROUGHNESS')throw new Error('Hero Avatar must use metallic-roughness PBR.');
  if(input.hairTechnique!=='HAIR_CARDS')throw new Error('Hero Avatar mobile hair must use hair cards.');
  for(const view of AVATAR_HERO_REQUIRED_VIEWS)if(!input.referenceViews[view])throw new Error(`Hero Avatar is missing ${view} concept reference.`);
  const completed=new Set(input.stages.map(x=>x.stage));
  for(const stage of AVATAR_ART_PIPELINE_STAGES)if(!completed.has(stage))throw new Error(`Hero Avatar has no production evidence for ${stage}.`);
  for(const evidence of input.stages){
    assertKey(evidence.sourceRevision,'source revision');assertKey(evidence.artistRevision,'artist revision');assertKey(evidence.tool,'art tool');assertKey(evidence.toolVersion,'art tool version');assertKey(evidence.reviewer,'reviewer');
    const timestamp=Date.parse(evidence.reviewedAt);if(!Number.isFinite(timestamp)||timestamp>Date.now()+5*60*1000)throw new Error(`Invalid production review timestamp for ${evidence.stage}.`);
  }
  return input;
}

export type AvatarModularGarmentRecipe = {
  recipeKey:string;
  silhouetteBase:string;
  sleeve:string;
  collar:string;
  length:string;
  fit:string;
  material:string;
  colorway:string;
  pattern?:string;
  accessories:string[];
};

export function avatarGarmentVariantKey(recipe:AvatarModularGarmentRecipe){
  for(const [value,label] of [[recipe.recipeKey,'recipe'],[recipe.silhouetteBase,'silhouette'],[recipe.sleeve,'sleeve'],[recipe.collar,'collar'],[recipe.length,'length'],[recipe.fit,'fit'],[recipe.material,'material'],[recipe.colorway,'colorway']] as const)assertKey(value,label);
  if(recipe.pattern)assertKey(recipe.pattern,'pattern');
  recipe.accessories.forEach(x=>assertKey(x,'accessory'));
  return [recipe.silhouetteBase,recipe.sleeve,recipe.collar,recipe.length,recipe.fit,recipe.material,recipe.colorway,recipe.pattern??'plain',...recipe.accessories.slice().sort()].join(':');
}
