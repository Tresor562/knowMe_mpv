import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {voiceClock,voiceUiState} from './voice-composer-model.ts';

test('voice actions never mistake cancel for send',()=>{
  assert.deepEqual(voiceUiState('idle',false),{
    canStart:true,canFinish:false,canCancel:true,canPreview:false,canSend:false
  });
  assert.equal(voiceUiState('starting',false).canCancel,true);
  assert.equal(voiceUiState('recording',false).canFinish,true);
  assert.equal(voiceUiState('recording',false).canSend,false);
  assert.equal(voiceUiState('stopping',false).canCancel,false);
  assert.equal(voiceUiState('sending',false).canCancel,false);
  assert.equal(voiceUiState('preview',false).canSend,true);
  assert.equal(voiceUiState('preview',true).canSend,false);
  assert.equal(voiceUiState('idle',true).canStart,false);
});
test('clock is stable on previews and invalid native durations',()=>{
  assert.equal(voiceClock(0),'00:00');
  assert.equal(voiceClock(59999),'00:59');
  assert.equal(voiceClock(60000),'01:00');
  assert.equal(voiceClock(3_661_000),'61:01');
  assert.equal(voiceClock(-1000),'00:00');
  assert.equal(voiceClock(Number.NaN),'00:00');
});
