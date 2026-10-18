import assert from 'node:assert/strict';
import test from 'node:test';
import { safeNotificationPath, notificationDestination, notificationSymbol, quietTimeActive, shouldShowInAppNotice } from './in-app-notification-model.ts';

const item = { id:'n1', title:'Publication', body:'Une nouvelle publication', type:'CREATOR_POST', category:'SOCIAL', createdAt:'2026-10-18T16:00:00Z' };
const enabled = { masterEnabled:true, realtimeEnabled:true, digestMode:'INSTANT', categorySettings:{SOCIAL:true} };
test('links only navigate to internal KnowMe routes', () => {
  assert.equal(safeNotificationPath('/messages/abc?filter=all#last'),'/messages/abc?filter=all#last');
  for(const value of ['https://evil.example/phish','//evil.example', '\\\\evil.example', 'javascript:alert(1)', null]) {
    assert.equal(safeNotificationPath(value),'/notifications');
  }
  assert.equal(notificationDestination({...item,data:{route:'/feed/123'}}),'/feed/123');
});
test('notification topics support messages, creator posts, mentions and security without emojis', () => {
  assert.equal(notificationSymbol('MESSAGE','MESSAGING'),'message');
  assert.equal(notificationSymbol('COMMENT_MENTION','SOCIAL'),'mention');
  assert.equal(notificationSymbol('CREATOR_POST','SOCIAL'),'post');
  assert.equal(notificationSymbol('SECURITY_LOGIN_ALERT','SECURITY'),'security');
});
test('mute, instant mode, quiet hours and explicit permission govern noncritical alerts', () => {
  const t = new Date('2026-10-18T22:30:00Z');
  assert.equal(shouldShowInAppNotice(item,enabled,t),true);
  assert.equal(shouldShowInAppNotice(item,null,t),false);
  assert.equal(shouldShowInAppNotice(item,{...enabled,masterEnabled:false},t),false);
  assert.equal(shouldShowInAppNotice(item,{...enabled,realtimeEnabled:false},t),false);
  assert.equal(shouldShowInAppNotice(item,{...enabled,digestMode:'CENTER_ONLY'},t),false);
  assert.equal(shouldShowInAppNotice(item,{...enabled,mutedTypes:['CREATOR_POST']},t),false);
  assert.equal(shouldShowInAppNotice(item,{...enabled,categorySettings:{SOCIAL:false}},t),false);
  assert.equal(shouldShowInAppNotice({...item,readAt:'2026-10-18T20:00:00Z'},enabled,t),false);
  assert.equal(shouldShowInAppNotice({...item,critical:true},{...enabled,masterEnabled:false},t),true);
  const quiet={...enabled,quietHoursEnabled:true,quietStartMinute:22*60,quietEndMinute:7*60,timezone:'UTC'};
  assert.equal(quietTimeActive(quiet,t),true);
  assert.equal(shouldShowInAppNotice(item,quiet,t),false);
  assert.equal(quietTimeActive(quiet,new Date('2026-10-18T13:30:00Z')),false);
});
