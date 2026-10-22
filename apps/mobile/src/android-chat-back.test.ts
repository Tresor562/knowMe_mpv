import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { resolve } from 'node:path';

const source=(file:string)=>readFileSync(resolve(process.cwd(),'src',file),'utf8');

test('Android system Back unwinds expression keyboard and conversation before root navigation',()=>{
  const messages=source('RealtimeMessagesPanel.tsx');
  assert.match(messages,/BackHandler\.addEventListener\('hardwareBackPress'/);
  const panel=messages.indexOf('if (panelOpen) { setPanelOpen(false); return true; }');
  const conversation=messages.indexOf('if (active) { closeConversation(); return true; }');
  assert.ok(panel>0&&conversation>panel);
  assert.match(messages,/if \(selectedFriend\) \{ setSelectedFriend\(null\); return true; \}/);
});

test('Android organization Back unwinds detail, tool and organization sheet in order',()=>{
  const organization=source('MessagesOrganizationExperience.tsx');
  const detail=organization.indexOf('if (organizationConversationId) { setOrganizationConversationId(null); return true; }');
  const tool=organization.indexOf('if (organizationTool) { setOrganizationTool(null); return true; }');
  const home=organization.indexOf('if (organizationOpen) { setOrganizationOpen(false); return true; }');
  assert.ok(detail>0&&tool>detail&&home>tool);
});
