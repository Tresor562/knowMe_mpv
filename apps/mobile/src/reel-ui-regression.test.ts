import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {resolve} from 'node:path';

const source=(name:string)=>readFileSync(resolve(process.cwd(),'src',name),'utf8');

test('Android Reel search is a separate opaque surface, not an overlay on video',()=>{
  const reels=source('ReelsExperience.tsx');
  assert.match(reels,/const visibleClips=clips/);
  assert.match(reels,/searchMatches=useMemo/);
  assert.match(reels,/searchMode:\{position:'absolute'/);
  assert.match(reels,/onPress=\{\(\)=>openSearchResult\(clip\.id\)\}/);
  assert.match(reels,/Keyboard\.dismiss\(\)/);
});

test('opening IME cannot resize paging geometry or restart the video',()=>{
  const reels=source('ReelsExperience.tsx');
  assert.match(reels,/if\(!keyboardVisible&&height>0/);
  assert.match(reels,/const shown=item\.id===active&&!offlineLibraryOpen/);
  assert.match(reels,/externallyPaused=\{[^\n]*keyboardVisible/);
  assert.match(reels,/scrollEnabled=\{!keyboardVisible&&!searchOpen/);
});

test('Reel timeline clears author caption and end screen is not expanded',()=>{
  const video=source('PublicPostVideo.tsx');
  assert.match(video,/reelSeek:\{top:119,bottom:undefined/);
  assert.match(video,/reelThinTrack:\{position:'absolute',left:18,right:18,top:112/);
  assert.match(video,/const progressMode=ended/);
  assert.match(video,/setSeekToMs\(Math\.max\(0,completedDuration-250\)\)/);
});

test('comments use a compact composer and readable existing comments',()=>{
  const comments=source('ReelQuickCommentSheet.tsx');
  assert.match(comments,/minHeight:40,maxHeight:112/);
  assert.match(comments,/comments\?roots=true/);
  assert.match(comments,/comments\.map\(comment=>/);
  assert.doesNotMatch(comments,/<TextInput ref=\{input\} autoFocus/);
});

test('side rail shows confirmed offline state or active progress',()=>{
  const reels=source('ReelsExperience.tsx');
  const video=source('PublicPostVideo.tsx');
  assert.match(reels,/offlineProgress\[item\.id\]\?\.saving/);
  assert.match(reels,/offlineStatus\[item\.id\]\?\(en\?'Saved':'Enregistrée'\)/);
  assert.match(video,/onOfflineProgress\?\./);
});
