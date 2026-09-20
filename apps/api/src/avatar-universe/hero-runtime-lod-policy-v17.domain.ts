export const HERO_RUNTIME_LOD_POLICY_VERSION=17 as const;

export type HeroLod=0|1|2;
export type HeroLodPolicyState={lod:HeroLod;lastSwitchMs:number};
export type HeroLodPolicySample={distanceM:number;p95FrameMs:number;nowMs:number};

// Enter thresholds are deliberately farther than exit thresholds: this hysteresis
// prevents camera jitter around a boundary from producing LOD ping-pong.
export const HERO_LOD_DISTANCE={
  lod0To1EnterM:3.0,
  lod1To0ExitM:2.4,
  lod1To2EnterM:7.0,
  lod2To1ExitM:5.8,
} as const;
export const HERO_LOD_MIN_RESIDENCY_MS=750;
export const HERO_LOD_PRESSURE_P95_MS=30;
export const HERO_LOD_RECOVERY_P95_MS=22;

const finiteNonNegative=(name:string,v:number)=>{if(!Number.isFinite(v)||v<0)throw new Error(`Hero LOD ${name} is invalid.`);};

export function selectHeroLod(state:HeroLodPolicyState,sample:HeroLodPolicySample):HeroLodPolicyState{
 finiteNonNegative('distance',sample.distanceM);finiteNonNegative('p95 frame time',sample.p95FrameMs);finiteNonNegative('time',sample.nowMs);
 if(![0,1,2].includes(state.lod)||!Number.isFinite(state.lastSwitchMs)||state.lastSwitchMs<0||sample.nowMs<state.lastSwitchMs)throw new Error('Hero LOD state is invalid.');
 if(sample.nowMs-state.lastSwitchMs<HERO_LOD_MIN_RESIDENCY_MS)return state;
 let next:HeroLod=state.lod;
 const pressure=sample.p95FrameMs>=HERO_LOD_PRESSURE_P95_MS;
 const recovered=sample.p95FrameMs<=HERO_LOD_RECOVERY_P95_MS;
 if(state.lod===0&&(sample.distanceM>=HERO_LOD_DISTANCE.lod0To1EnterM||pressure))next=1;
 else if(state.lod===1){
   if(sample.distanceM>=HERO_LOD_DISTANCE.lod1To2EnterM||pressure)next=2;
   else if(sample.distanceM<=HERO_LOD_DISTANCE.lod1To0ExitM&&recovered)next=0;
 }else if(state.lod===2&&sample.distanceM<=HERO_LOD_DISTANCE.lod2To1ExitM&&recovered)next=1;
 return next===state.lod?state:{lod:next,lastSwitchMs:sample.nowMs};
}
