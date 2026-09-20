import {HERO_LOD_MIN_RESIDENCY_MS,selectHeroLod} from './hero-runtime-lod-policy-v17.domain';

describe('Hero runtime LOD policy v17',()=>{
 it('holds the current LOD inside the hysteresis band',()=>{
  expect(selectHeroLod({lod:0,lastSwitchMs:0},{distanceM:2.8,p95FrameMs:18,nowMs:1000}).lod).toBe(0);
  expect(selectHeroLod({lod:1,lastSwitchMs:0},{distanceM:2.8,p95FrameMs:18,nowMs:1000}).lod).toBe(1);
  expect(selectHeroLod({lod:2,lastSwitchMs:0},{distanceM:6.2,p95FrameMs:18,nowMs:1000}).lod).toBe(2);
 });
 it('moves only one adjacent LOD per decision',()=>{
  expect(selectHeroLod({lod:0,lastSwitchMs:0},{distanceM:50,p95FrameMs:40,nowMs:1000}).lod).toBe(1);
  expect(selectHeroLod({lod:2,lastSwitchMs:0},{distanceM:0.5,p95FrameMs:10,nowMs:1000}).lod).toBe(1);
 });
 it('enforces minimum residency to prevent ping-pong',()=>{
  const switched=selectHeroLod({lod:0,lastSwitchMs:0},{distanceM:4,p95FrameMs:18,nowMs:1000});
  expect(switched.lod).toBe(1);
  expect(selectHeroLod(switched,{distanceM:1,p95FrameMs:10,nowMs:1000+HERO_LOD_MIN_RESIDENCY_MS-1}).lod).toBe(1);
  expect(selectHeroLod(switched,{distanceM:1,p95FrameMs:10,nowMs:1000+HERO_LOD_MIN_RESIDENCY_MS}).lod).toBe(0);
 });
 it('degrades under sustained frame pressure and recovers only when healthy',()=>{
  expect(selectHeroLod({lod:0,lastSwitchMs:0},{distanceM:1,p95FrameMs:31,nowMs:1000}).lod).toBe(1);
  expect(selectHeroLod({lod:1,lastSwitchMs:0},{distanceM:1,p95FrameMs:25,nowMs:1000}).lod).toBe(1);
  expect(selectHeroLod({lod:1,lastSwitchMs:0},{distanceM:1,p95FrameMs:20,nowMs:1000}).lod).toBe(0);
 });
 it('rejects non-finite and time-reversing samples',()=>{
  expect(()=>selectHeroLod({lod:0,lastSwitchMs:0},{distanceM:Number.NaN,p95FrameMs:10,nowMs:1000})).toThrow();
  expect(()=>selectHeroLod({lod:0,lastSwitchMs:1000},{distanceM:1,p95FrameMs:10,nowMs:999})).toThrow();
 });
});
