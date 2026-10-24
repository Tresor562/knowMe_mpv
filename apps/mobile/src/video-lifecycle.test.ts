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
  assert.match(reels,/if\(!searchOpen&&!commentPost&&!keyboardVisible&&height>0/);
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

test('portrait Reels use crop only, while feed and Stories preserve aspect-fit',()=>{
  const player=readReelSource('PublicPostVideo.tsx');
  const native=readReelSource('NativeStoryVideo.tsx');
  const java=readFileSync('plugins/native/android/KnowMeStoryVideoPackage.java','utf8');
  assert.match(player,/resizeMode=\{onDoubleTap\?'cover':'contain'\}/);
  assert.match(native,/resizeMode=\{resizeMode\}/);
  assert.match(java,/@ReactProp\(name="resizeMode"\)/);
  assert.match(java,/player\.setScaleX\(scale\)/);
  assert.match(java,/player\.setScaleY\(scale\)/);
  assert.match(java,/if \(!coverMode \|\| preparedMedia==null\)/);
});

test('failed offline saving is visibly retryable without faking successful saves',()=>{
  const reels=readReelSource('ReelsExperience.tsx');
  const player=readReelSource('PublicPostVideo.tsx');
  assert.match(reels,/offlineProgress\[item\.id\]\?\.error\?\(en\?'Retry':'Réessayer'\)/);
  assert.match(player,/setOfflineError\(true\)/);
  assert.match(player,/onOfflineProgress\?\.\(\{saving,percent:savePercent,error:offlineError\}\)/);
});

test('completion last-frame rewind does not corrupt displayed video end timestamp',()=>{
  const player=readReelSource('PublicPostVideo.tsx');
  assert.match(player,/endedRef\.current=true;\s*setEnded\(true\)/);
  assert.match(player,/if\(preloadPaused&&!autoPlay\|\|endedRef\.current\)return/);
  assert.match(player,/endedRef\.current=false/);
});


test('finished video cannot implicitly replay until explicit seek',()=>{
  const java=readFileSync('plugins/native/android/KnowMeStoryVideoPackage.java','utf8');
  const video=readReelSource('PublicPostVideo.tsx');
  assert.match(java,/completed=true;/);
  assert.match(java,/else if \(!view\.completed\) view\.player\.start\(\)/);
  assert.match(java,/if\(target<duration-250\)/);
  assert.match(video,/if\(autoPlay&&!local&&!error\)void open\(\)/);
});
test('five following Reels are prepared before scroll and pagination begins early',()=>{
  const reels=readReelSource('ReelsExperience.tsx');
  const video=readReelSource('PublicPostVideo.tsx');
  assert.match(reels,/index<=activeIndex\+5/);
  assert.match(reels,/activeIndex>=visibleClips\.length-8/);
  assert.match(video,/if\(!preloadPaused\|\|autoPlay\|\|local/);
});
test('real MP4 stills are generated by bounded Android background work',()=>{
  const java=readFileSync('plugins/native/android/KnowMeStoryVideoPackage.java','utf8');
  const native=readReelSource('NativePublicVideoStill.tsx');
  const feed=readReelSource('NativeFeedReelSuggestions.tsx');
  assert.match(java,/KnowMePublicVideoStill/);
  assert.match(java,/Executors\.newFixedThreadPool\(2\)/);
  assert.match(java,/MediaMetadataRetriever/);
  assert.match(java,/validPublicVideoUri\(uri\)/);
  assert.match(native,/requireNativeComponent/);
  assert.match(feed,/<NativePublicVideoStill/);
});
test('both magnifiers navigate to live universal search, not video-only search',()=>{
  const app=readFileSync('App.tsx','utf8');
  const reel=readReelSource('ReelsExperience.tsx');
  const feed=readReelSource('FeedExperience.tsx');
  const search=readReelSource('UniversalSearchExperience.tsx');
  assert.match(app,/screen==='search'/);
  assert.match(app,/onOpenSearch=\{openUniversalSearch\}/);
  assert.match(feed,/onPress=\{onOpenSearch\}/);
  assert.match(reel,/if\(onOpenSearch\)onOpenSearch\(\)/);
  assert.match(search,/setTimeout\(\(\)=>\{void search\(normalized,activeKinds\);\},270\)/);
  assert.match(search,/requestEpoch\.current/);
});
