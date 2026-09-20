import {HeroAndroidMeasuredProfile,verifyHeroAndroidMeasuredProfile} from './hero-runtime-android-profile-v16.domain';
import {HERO_LOD_MIN_RESIDENCY_MS,HeroLod} from './hero-runtime-lod-policy-v17.domain';

export const HERO_RUNTIME_LOD_TELEMETRY_VERSION=18 as const;
export const HERO_LOD_MAX_TRANSITIONS_PER_600_FRAMES=12;
export const HERO_LOD_MAX_OSCILLATIONS_PER_600_FRAMES=2;
export type HeroLodTransitionReason='distance'|'frame-pressure'|'recovery';
export type HeroLodMeasuredTransition={from:HeroLod;to:HeroLod;distanceM:number;frame:number;atMs:number;p95FrameMs:number;reason:HeroLodTransitionReason};
export type HeroAndroidLodTelemetryProfile=Omit<HeroAndroidMeasuredProfile,'lodTransitions'>&{lodTransitions:HeroLodMeasuredTransition[]};

const finiteNonNegative=(name:string,v:number)=>{if(!Number.isFinite(v)||v<0)throw new Error(`Android LOD telemetry ${name} is invalid.`);};
const scaledBudget=(base:number,frames:number)=>Math.max(base,Math.ceil(base*frames/600));

export function verifyHeroAndroidLodTelemetry(profile:HeroAndroidLodTelemetryProfile){
 // Preserve every v16 provenance/performance invariant before adding v18 telemetry invariants.
 verifyHeroAndroidMeasuredProfile(profile);
 const transitions=profile.lodTransitions??[];
 let oscillations=0;
 for(let i=0;i<transitions.length;i++){
  const t=transitions[i];finiteNonNegative('transition time',t.atMs);finiteNonNegative('transition p95 frame time',t.p95FrameMs);
  if(!['distance','frame-pressure','recovery'].includes(t.reason))throw new Error('Android LOD telemetry reason is invalid.');
  if(t.reason==='distance'&&t.to<=t.from)throw new Error('Distance LOD transition must degrade detail.');
  if(t.reason==='frame-pressure'&&(t.to<=t.from||t.p95FrameMs<30))throw new Error('Frame-pressure LOD transition is inconsistent.');
  if(t.reason==='recovery'&&(t.to>=t.from||t.p95FrameMs>22))throw new Error('Recovery LOD transition is inconsistent.');
  if(i>0){const prev=transitions[i-1];if(t.frame<=prev.frame||t.atMs<prev.atMs)throw new Error('Android LOD telemetry transitions are not chronological.');if(t.atMs-prev.atMs<HERO_LOD_MIN_RESIDENCY_MS)throw new Error('Android LOD telemetry violates minimum residency.');if(prev.from===t.to&&prev.to===t.from)oscillations++;}
 }
 const transitionBudget=scaledBudget(HERO_LOD_MAX_TRANSITIONS_PER_600_FRAMES,profile.measurement.frames);
 const oscillationBudget=scaledBudget(HERO_LOD_MAX_OSCILLATIONS_PER_600_FRAMES,profile.measurement.frames);
 if(transitions.length>transitionBudget)throw new Error('Android LOD transition-rate budget exceeded.');
 if(oscillations>oscillationBudget)throw new Error('Android LOD oscillation budget exceeded.');
 return {profile,analysis:{transitions:transitions.length,oscillations,transitionBudget,oscillationBudget}};
}
