import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeAvatarCrop,GROUP_AVATAR_OUTPUT_SIZE,GROUP_AVATAR_PREVIEW_SIZE
} from './group-avatar-crop.ts';

test('square photo covers the crop frame without cropping at zoom 1',()=>{
  const a=computeAvatarCrop(600,600);
  assert.equal(a.cssWidth,GROUP_AVATAR_PREVIEW_SIZE);
  assert.equal(a.cssHeight,GROUP_AVATAR_PREVIEW_SIZE);
  assert.equal(a.sourceX,0);
  assert.equal(a.sourceY,0);
  assert.equal(a.sourceSize,600);
  assert.equal(GROUP_AVATAR_OUTPUT_SIZE,768);
});
test('wide photo center crop and bounded pan produce valid source rect',()=>{
  const center=computeAvatarCrop(1200,600);
  assert.equal(center.sourceSize,600);
  assert.equal(center.sourceX,300);
  assert.equal(center.sourceY,0);
  const left=computeAvatarCrop(1200,600,1,9999,0);
  const right=computeAvatarCrop(1200,600,1,-9999,0);
  assert.equal(left.sourceX,0);
  assert.equal(right.sourceX,600);
  assert.ok(left.panX>0);
  assert.ok(right.panX<0);
});
test('portrait photo can pan vertically but cannot expose blank pixels',()=>{
  const top=computeAvatarCrop(600,1200,1,9999,9999);
  const bottom=computeAvatarCrop(600,1200,1,0,-9999);
  assert.equal(top.sourceX,0);
  assert.equal(top.sourceY,0);
  assert.equal(bottom.sourceY,600);
  assert.equal(top.panX,0);
  assert.equal(bottom.sourceSize,600);
});
test('zoom clamps and source crop always stays inside image dimensions',()=>{
  for(const value of [0,1,1.3,2,3,100,Infinity,NaN]){
    const crop=computeAvatarCrop(1100,700,value,-999,999);
    assert.ok(crop.zoom>=1&&crop.zoom<=3);
    assert.ok(crop.sourceX>=0&&crop.sourceY>=0);
    assert.ok(crop.sourceX+crop.sourceSize<=1100+0.001);
    assert.ok(crop.sourceY+crop.sourceSize<=700+0.001);
  }
  const zoomed=computeAvatarCrop(1100,700,2);
  assert.equal(zoomed.sourceSize,350);
});
test('invalid image metadata is never accepted for crop',()=>{
  for(const size of [0,-1,NaN,Infinity]){
    assert.throws(()=>computeAvatarCrop(size,600),/INVALID_AVATAR_DIMENSIONS/);
    assert.throws(()=>computeAvatarCrop(800,size),/INVALID_AVATAR_DIMENSIONS/);
  }
});
