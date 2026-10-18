import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {videoTime,seekTimeFromTrack,clampVideoSeek,parseVideoTimestamp} from './video-time.ts';

test('video clock never wraps after 59m59s, including five-hour videos',()=>{
  assert.equal(videoTime(0),'0:00');
  assert.equal(videoTime(61000),'1:01');
  assert.equal(videoTime(3599000),'59:59');
  assert.equal(videoTime(3600000),'1:00:00');
  assert.equal(videoTime(7202000),'2:00:02');
  assert.equal(videoTime(18000000),'5:00:00');
  assert.equal(videoTime(-1),'0:00');
  assert.equal(videoTime(Number.NaN),'0:00');
});

test('timeline scrubbing remains precise for videos longer than five hours',()=>{
  const fiveHours=18_000_000;
  assert.equal(seekTimeFromTrack(fiveHours,0,320),0);
  assert.equal(seekTimeFromTrack(fiveHours,160,320),9_000_000);
  assert.equal(seekTimeFromTrack(fiveHours,320,320),fiveHours);
  assert.equal(seekTimeFromTrack(fiveHours,-50,320),0);
  assert.equal(seekTimeFromTrack(fiveHours,450,320),fiveHours);
  assert.equal(seekTimeFromTrack(fiveHours,50,0),0);
  assert.equal(seekTimeFromTrack(fiveHours,Number.NaN,320),0);
});

test('relative seeking clamps to 0 and duration, including invalid positions',()=>{
  assert.equal(clampVideoSeek(1000,18_000_000,-10_000),0);
  assert.equal(clampVideoSeek(17_999_500,18_000_000,10_000),18_000_000);
  assert.equal(clampVideoSeek(9_000_000,18_000_000,10_000),9_010_000);
  assert.equal(clampVideoSeek(Number.NaN,18_000_000,10_000),10_000);
  assert.equal(clampVideoSeek(1000,0,5000),0);
  assert.equal(clampVideoSeek(1000,Number.POSITIVE_INFINITY,5000),0);
});

test('direct time entry seeks precisely through five-hour playback',()=>{
  assert.equal(parseVideoTimestamp('0',18_000_000),0);
  assert.equal(parseVideoTimestamp('1:30',18_000_000),90_000);
  assert.equal(parseVideoTimestamp('90:05',18_000_000),5_405_000);
  assert.equal(parseVideoTimestamp('2:14:30',18_000_000),8_070_000);
  assert.equal(parseVideoTimestamp(' 5:00:00 ',18_000_000),18_000_000);
  assert.equal(parseVideoTimestamp('5:22:22',18_000_000),18_000_000);
});
test('direct seek entry rejects invalid and unsafe times',()=>{
  for(const value of ['','-',':','2:75','1:99:00','1:20:61','hi','2:2:3:4',
    '1e9','-2:00','99999999999999999','2.5']){
    assert.equal(parseVideoTimestamp(value,18_000_000),null,value);
  }
  assert.equal(parseVideoTimestamp('1:15',0),null);
  assert.equal(parseVideoTimestamp('1:15',Number.NaN),null);
  assert.equal(parseVideoTimestamp('1:15',Number.POSITIVE_INFINITY),null);
});
