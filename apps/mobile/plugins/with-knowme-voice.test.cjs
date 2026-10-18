'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const {injectVoice,addVoicePermission} = require('./with-knowme-voice.cjs');

test('add native voice package only once in Expo Kotlin and Java variants',()=>{
  for (const main of [
    'val packages = PackageList(this).packages',
    'PackageList(this).packages.apply {',
    'List<ReactPackage> packages = new PackageList(this).getPackages();'
  ]) {
    const joined = injectVoice(main);
    assert.match(joined,/KnowMeVoicePackage/);
    assert.equal(injectVoice(joined),joined);
  }
  assert.throws(()=>injectVoice('No known package list'),/Unsupported Expo MainApplication/);
});
test('requires only microphone permission and is idempotent',()=>{
  const m={'uses-permission':[{$:{'android:name':'android.permission.INTERNET'}}]};
  addVoicePermission(m);
  addVoicePermission(m);
  assert.deepEqual(m['uses-permission'].map(x=>x.$['android:name']),
    ['android.permission.INTERNET','android.permission.RECORD_AUDIO']);
});
test('native recorder uses private cache and real Ogg Opus',()=>{
  const code=fs.readFileSync(path.join(__dirname,'native/android/KnowMeVoicePackage.java'),'utf8');
  assert.match(code,/MediaRecorder.OutputFormat.OGG/);
  assert.match(code,/MediaRecorder.AudioEncoder.OPUS/);
  assert.match(code,/getCacheDir\(\)/);
  assert.match(code,/Manifest.permission.RECORD_AUDIO/);
  assert.match(code,/allowedFile\(uri\)/);
  assert.doesNotMatch(code,/MANAGE_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE/);
});

test('voice composer requires explicit send and bounds playback seeking',async()=>{
  // The mobile test script runs Node with --experimental-strip-types.
  const {voiceUiState,voiceClock,voiceProgress,voiceSeekMs}=await import('../src/voice-composer-model.ts');
  assert.equal(voiceUiState('recording',false).canSend,false);
  assert.equal(voiceUiState('preview',false).canSend,true);
  assert.equal(voiceUiState('preview',true).canSend,false);
  assert.equal(voiceUiState('sending',false).canCancel,false);
  assert.equal(voiceUiState('starting',false).canCancel,true);
  assert.equal(voiceClock(61000),'01:01');
  assert.equal(voiceProgress(-100,30000),0);
  assert.equal(voiceProgress(35000,30000),1);
  assert.equal(voiceSeekMs(-15,200,30000),0);
  assert.equal(voiceSeekMs(250,200,30000),30000);
  assert.equal(voiceSeekMs(100,200,30000),15000);
  assert.equal(voiceSeekMs(Number.NaN,200,30000),0);
});
