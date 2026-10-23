import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {shouldSuspendVideo} from './video-lifecycle.ts';
import {reelsFeedState,chooseVisibleReel} from './reels-feed-state.ts';
test('player suspends on background or inactive and preserves manual pause',()=>{
  assert.equal(shouldSuspendVideo(false,'active'),false);
  assert.equal(shouldSuspendVideo(false,'inactive'),true);
  assert.equal(shouldSuspendVideo(false,'background'),true);
  assert.equal(shouldSuspendVideo(true,'active'),true);
  assert.equal(shouldSuspendVideo(true,'background'),true);
  assert.equal(shouldSuspendVideo(false,null),false);
});

test('Reels do not confuse network failure with a genuinely empty feed',()=>{
  assert.equal(reelsFeedState({clips:0,posts:0,loading:true,failed:false,hasMore:true}),'loading');
  assert.equal(reelsFeedState({clips:0,posts:0,loading:false,failed:true,hasMore:true}),'failed');
  assert.equal(reelsFeedState({clips:0,posts:0,loading:false,failed:false,hasMore:false}),'empty');
});

test('Reels offer explicit search for video clips when legacy posts are all text',()=>{
  assert.equal(reelsFeedState({clips:0,posts:20,loading:false,failed:false,hasMore:true}),'browse');
  assert.equal(reelsFeedState({clips:0,posts:20,loading:false,failed:false,hasMore:false}),'empty');
  assert.equal(reelsFeedState({clips:2,posts:20,loading:false,failed:true,hasMore:true}),'ready');
});

test('refresh preserves a known clip and selects first when the old Reel disappears',()=>{
  assert.equal(chooseVisibleReel(['clip-a','clip-b','clip-c'],'clip-b'),'clip-b');
  assert.equal(chooseVisibleReel(['clip-x','clip-y'],'clip-b'),'clip-x');
  assert.equal(chooseVisibleReel(['clip-x','clip-y'],null),'clip-x');
  assert.equal(chooseVisibleReel([],null),null);
  assert.equal(chooseVisibleReel([],'clip-a'),null);
});


test('paused Android video cards prime only a silent first frame and never keep playing', () => {
  const java = readFileSync(decodeURIComponent(new URL('../plugins/native/android/KnowMeStoryVideoPackage.java', import.meta.url).pathname), 'utf8');
  assert.match(java, /setMutedForPreview\(paused\)/);
  assert.match(java, /MEDIA_INFO_VIDEO_RENDERING_START/);
  assert.match(java, /preparedMedia == source && paused/);
  assert.match(java, /handler\.postDelayed\(\(\) ->/);
  assert.match(java, /if \(preparedMedia == media && paused && ready\) player\.pause\(\)/);
});

// Android Reel search/keyboard/timeline regression contracts.
const readReelSource=(name:string)=>readFileSync('src/'+name,'utf8');
test('Android Reel search is a separate opaque surface, not an overlay on video',()=>{
  const reels=readReelSource('ReelsExperience.tsx');
  assert.match(reels,/const visibleClips=clips/);
  assert.match(reels,/searchMatches=useMemo/);
  assert.match(reels,/searchMode:\{position:'absolute'/);
  assert.match(reels,/onPress=\{\(\)=>openSearchResult\(clip\.id\)\}/);
  assert.match(reels,/Keyboard\.dismiss\(\)/);
});

test('opening IME cannot resize paging geometry or restart the video',()=>{
  const reels=readReelSource('ReelsExperience.tsx');
  assert.match(reels,/if\(!keyboardVisible&&height>0/);
  assert.match(reels,/const shown=item\.id===active&&!offlineLibraryOpen/);
  assert.match(reels,/externallyPaused=\{[^\n]*keyboardVisible/);
  assert.match(reels,/scrollEnabled=\{!keyboardVisible&&!searchOpen/);
});

test('Reel timeline clears author caption and end screen is not expanded',()=>{
  const video=readReelSource('PublicPostVideo.tsx');
  assert.match(video,/reelSeek:\{top:119,bottom:undefined/);
  assert.match(video,/reelThinTrack:\{position:'absolute',left:18,right:18,top:112/);
  assert.match(video,/const progressMode=ended/);
  assert.match(video,/setSeekToMs\(Math\.max\(0,completedDuration-250\)\)/);
});

test('comments use a compact composer and readable existing comments',()=>{
  const comments=readReelSource('ReelQuickCommentSheet.tsx');
  assert.match(comments,/minHeight:40,maxHeight:112/);
  assert.match(comments,/comments\?roots=true/);
  assert.match(comments,/comments\.map\(comment=>/);
  assert.doesNotMatch(comments,/<TextInput ref=\{input\} autoFocus/);
});

test('side rail shows confirmed offline state or active progress',()=>{
  const reels=readReelSource('ReelsExperience.tsx');
  const video=readReelSource('PublicPostVideo.tsx');
  assert.match(reels,/offlineProgress\[item\.id\]\?\.saving/);
  assert.match(reels,/offlineStatus\[item\.id\]\?\(en\?'Saved':'Enregistrée'\)/);
  assert.match(video,/onOfflineProgress\?\./);
});
