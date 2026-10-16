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
