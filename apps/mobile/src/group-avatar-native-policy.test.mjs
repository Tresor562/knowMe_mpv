import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateGroupAvatarCandidate,MAX_GROUP_AVATAR_BYTES,privateGroupAvatarImageUrl
} from './group-avatar-native-policy.ts';

const edit={read:true,canEdit:true,maxBytes:MAX_GROUP_AVATAR_BYTES,
  allowedMime:['image/jpeg','image/png','image/webp']};
test('avatar respects byte/mime limits, including server restrictions',()=>{
  assert.equal(validateGroupAvatarCandidate('image/png',2048,edit),null);
  assert.equal(validateGroupAvatarCandidate('image/jpeg',1023,edit),'SIZE');
  assert.equal(validateGroupAvatarCandidate('image/gif',2048,edit),'FORMAT');
  assert.equal(validateGroupAvatarCandidate('image/png',MAX_GROUP_AVATAR_BYTES+1,edit),'SIZE');
  assert.equal(validateGroupAvatarCandidate('image/png',Number.NaN,edit),'SIZE');
  assert.equal(validateGroupAvatarCandidate('image/png',2048,{...edit,canEdit:false}),'PERMISSION');
  assert.equal(validateGroupAvatarCandidate('image/webp',2048,{...edit,allowedMime:['image/png']}),'PERMISSION');
  assert.equal(validateGroupAvatarCandidate('image/png',2048,{...edit,maxBytes:1024}),'SIZE');
});
test('private group avatar URLs never fall back to public user avatars',()=>{
  assert.equal(privateGroupAvatarImageUrl('https://knowme.example','group/one',5),
    'https://knowme.example/conversations/group%2Fone/group/avatar?revision=5');
});
