import assert from 'node:assert/strict';
import test from 'node:test';
import {avatarCropFrame} from './group-avatar-crop.ts';

test('square photo fills the viewport without distortion',()=>{
 const f=avatarCropFrame(1000,1000,720,1,{x:0,y:0});
 assert.deepEqual({x:f.x,y:f.y,width:f.width,height:f.height},
   {x:0,y:0,width:720,height:720});
});
test('wide image crops horizontal sides with bounded pan',()=>{
 const f=avatarCropFrame(2000,1000,720,1,{x:99999,y:70});
 assert.equal(f.width,1440);
 assert.equal(f.height,720);
 assert.equal(f.x,0);
 assert.equal(f.y,0);
 assert.deepEqual(f.pan,{x:360,y:0});
});
test('zoomed portrait still covers all corners',()=>{
 const f=avatarCropFrame(500,1000,720,2,{x:-999,y:999});
 assert.equal(f.width,720);
 assert.equal(f.height,1440);
 assert.equal(f.x,0);
 assert.equal(f.y,0);
 assert.deepEqual(f.pan,{x:0,y:360});
});
test('invalid inputs are rejected and zoom bounded',()=>{
 assert.throws(()=>avatarCropFrame(0,500,720,1,{x:0,y:0}));
 const a=avatarCropFrame(800,600,720,Infinity,{x:Infinity,y:NaN});
 const b=avatarCropFrame(800,600,720,1,{x:0,y:0});
 assert.deepEqual(a,b);
});
