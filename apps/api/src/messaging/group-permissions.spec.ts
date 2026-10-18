import {describe,it,expect} from '@jest/globals';
import {readGroupPermissions,maySendGroupMessage} from './group-permissions';
describe('group message permissions',()=>{
 it('preserves existing groups, public and private default behavior',()=>{
   expect(readGroupPermissions(null)).toEqual({sendMessages:'ALL'});
   expect(maySendGroupMessage('MEMBER',null)).toBe(true);
   expect(maySendGroupMessage('MEMBER',{})).toBe(true);
 });
 it('enforces admin-only messages without locking out owner and moderators',()=>{
   const policy={sendMessages:'ADMINS'};
   expect(maySendGroupMessage('MEMBER',policy)).toBe(false);
   expect(maySendGroupMessage('ADMIN',policy)).toBe(true);
   expect(maySendGroupMessage('OWNER',policy)).toBe(true);
 });
 it('ignores untrusted values and never escalates a member to admin',()=>{
   expect(readGroupPermissions({sendMessages:'OWNER'})).toEqual({sendMessages:'ALL'});
   expect(readGroupPermissions(['ADMINS'])).toEqual({sendMessages:'ALL'});
 });
});
