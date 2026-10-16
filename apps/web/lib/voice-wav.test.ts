import assert from 'node:assert/strict';
import test from 'node:test';
import {encodeKnowMeVoiceWav} from './voice-wav.ts';

test('WAV is mono 16-bit PCM and scanner-readable RIFF/WAVE',()=>{
 const pcm=new Float32Array(48000).fill(.125);
 const wav=encodeKnowMeVoiceWav([pcm],48000);
 const view=new DataView(wav.buffer);
 assert.equal(Buffer.from(wav.subarray(0,4)).toString('ascii'),'RIFF');
 assert.equal(Buffer.from(wav.subarray(8,12)).toString('ascii'),'WAVE');
 assert.equal(view.getUint16(22,true),1);
 assert.equal(view.getUint32(24,true),16000);
 assert.equal(view.getUint16(34,true),16);
 assert.equal(wav.length,44+16000*2);
 assert.equal(view.getUint32(4,true),wav.length-8);
});
test('prevents empty and sub-half-second voices',()=>{
 assert.throws(()=>encodeKnowMeVoiceWav([],48000),/Aucune donnée/);
 assert.throws(()=>encodeKnowMeVoiceWav([new Float32Array(6000)],48000),/court/);
});
test('caps long input and clamps out-of-range microphone samples',()=>{
 const wav=encodeKnowMeVoiceWav([new Float32Array(48000).fill(4)],48000,1);
 assert.equal(wav.length,44+16000*2);
 assert.equal(new DataView(wav.buffer).getInt16(44,true),32767);
});
