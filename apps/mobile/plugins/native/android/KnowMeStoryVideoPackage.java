package com.knowme.app.video;

import android.content.Context;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.MediaController;
import android.widget.VideoView;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.ReactPackage;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewManager;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.uimanager.events.RCTEventEmitter;
import com.facebook.react.common.MapBuilder;
import java.io.File;
import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;

public final class KnowMeStoryVideoPackage implements ReactPackage {
  @Override public List<NativeModule> createNativeModules(ReactApplicationContext context) {
    return Collections.emptyList();
  }
  @Override public List<ViewManager> createViewManagers(ReactApplicationContext context) {
    return Arrays.<ViewManager>asList(new StoryVideoManager());
  }

  public static final class StoryVideoManager extends SimpleViewManager<StoryContainer> {
    @Override public String getName() { return "KnowMeStoryVideoView"; }

    @Override protected StoryContainer createViewInstance(ThemedReactContext context) {
      return new StoryContainer(context);
    }

    @ReactProp(name="sourceUri")
    public void setSourceUri(StoryContainer view, String uri) {
      view.setSourceUri(uri);
    }

    @ReactProp(name="paused", defaultBoolean=false)
    public void setPaused(StoryContainer view, boolean paused) {
      view.paused = paused;
      view.setMutedForPreview(paused);
      // A paused preview must not indefinitely keep the whole device awake.
      view.player.setKeepScreenOn(!paused && view.ready);
      if (view.ready) {
        if (paused) view.player.pause();
        else if (!view.completed) view.player.start();
      }
    }

    @ReactProp(name="nativeControls", defaultBoolean=true)
    public void nativeControls(StoryContainer view, boolean enabled) {
      view.setNativeControls(enabled);
    }

    @ReactProp(name="resizeMode")
    public void resizeMode(StoryContainer view, String mode) {
      view.setCoverMode("cover".equals(mode));
    }

    @ReactProp(name="seekToMs", defaultDouble=-1)
    public void seekToMs(StoryContainer view, double millis) {
      if (Double.isNaN(millis) || Double.isInfinite(millis) || millis<0) return;
      view.seekToMs=Math.min(Math.round(millis), Integer.MAX_VALUE);
      if (view.ready) view.applySeek();
    }

    @Override
    public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
      Map<String, Object> events=MapBuilder.newHashMap();
      events.put("topProgress",MapBuilder.of("registrationName","onProgress"));
      events.put("topPlaybackError",MapBuilder.of("registrationName","onPlaybackError"));
      events.put("topPlaybackComplete",MapBuilder.of("registrationName","onPlaybackComplete"));
      return events;
    }

    @Override public void onDropViewInstance(StoryContainer view) {
      view.release();
      super.onDropViewInstance(view);
    }
  }

  public static final class StoryContainer extends FrameLayout {
    final VideoView player;
    MediaController storyControls;
    boolean ready = false;
    boolean paused = false;
    boolean completed = false;
    MediaPlayer preparedMedia;
    boolean coverMode = false;
    String currentUri = "";
    long seekToMs = -1;
    final Handler handler = new Handler(Looper.getMainLooper());
    final Runnable ticker = new Runnable() {
      @Override public void run() {
        if (ready) emitProgress();
        if (getWindowToken()!=null) handler.postDelayed(this, 1000L);
      }
    };
    void emitProgress() {
      if (getId() <= 0 || !(getContext() instanceof ThemedReactContext)) return;
      WritableMap event = Arguments.createMap();
      event.putDouble("positionMs", Math.max(0, player.getCurrentPosition()));
      event.putDouble("durationMs", Math.max(0, player.getDuration()));
      ((ThemedReactContext)getContext()).getJSModule(RCTEventEmitter.class)
        .receiveEvent(getId(), "topProgress", event);
    }
    // Native paused VideoViews can remain black because some decoders only
    // render the first frame after start(). Briefly start a SILENT preview,
    // then pause when the frame is rendered (with a bounded timeout).
    void setMutedForPreview(boolean silent) {
      if (preparedMedia == null) return;
      try { preparedMedia.setVolume(silent ? 0f : 1f, silent ? 0f : 1f); }
      catch (IllegalStateException ignored) { }
    }
    void setCoverMode(boolean cover) {
      coverMode=cover;
      updateVideoScale();
    }

    // VideoView defaults to contain and leaves horizontal/vertical black bands.
    // Scale only immersive Reels, preserving one aspect ratio (no stretching).
    // Stories/feed keep their original contain behavior.
    void updateVideoScale() {
      if (!coverMode || preparedMedia==null) {
        player.setScaleX(1f);
        player.setScaleY(1f);
        return;
      }
      int vw=getWidth(),vh=getHeight();
      int videoW=preparedMedia.getVideoWidth(),videoH=preparedMedia.getVideoHeight();
      if (vw<=0 || vh<=0 || videoW<=0 || videoH<=0) return;
      double videoAspect=(double)videoW/videoH;
      double containedW=Math.min(vw,vh*videoAspect);
      double containedH=Math.min(vh,vw/videoAspect);
      if (containedW<=0 || containedH<=0) return;
      float scale=(float)Math.max((double)vw/containedW,(double)vh/containedH);
      player.setScaleX(scale);
      player.setScaleY(scale);
    }

    @Override protected void onSizeChanged(int w,int h,int oldw,int oldh) {
      super.onSizeChanged(w,h,oldw,oldh);
      updateVideoScale();
    }

    void setNativeControls(boolean enabled) {
      if (!enabled) {
        if (storyControls != null) storyControls.hide();
        player.setMediaController(null);
        return;
      }
      // Stories still use their original Android transport. Custom Reels
      // and in-feed previews opt out so this overlay never escapes a card.
      if (storyControls == null) {
        storyControls = new MediaController(getContext());
        storyControls.setAnchorView(player);
      }
      player.setMediaController(storyControls);
    }
    void applySeek() {
      if (!ready || seekToMs<0) return;
      int duration=player.getDuration();
      if (duration>0) {
        int target=(int)Math.min(seekToMs, duration);
        player.seekTo(target);
        // Replay only after an explicit seek away from the end.
        if(target<duration-250) {
          completed=false;
          if(!paused)player.start();
        }
      }
      seekToMs=-1;
      emitProgress();
    }
    StoryContainer(Context context) {
      super(context);
      player = new VideoView(context);
      player.setLayoutParams(new LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT));
      player.setKeepScreenOn(false);
      setClipChildren(true);
      player.addOnLayoutChangeListener((view,left,top,right,bottom,
        oldLeft,oldTop,oldRight,oldBottom)->updateVideoScale());
      // KnowMe renders its own accessible controls: never attach the Android
      // MediaController, which leaks transport overlays onto feed thumbnails.
      player.setMediaController(null);
      player.setOnPreparedListener(media -> {
        ready=true;
        completed=false;
        preparedMedia=media;
        media.setLooping(false);
        updateVideoScale();
        setMutedForPreview(paused);
        player.setKeepScreenOn(!paused);
        applySeek();
        media.setOnInfoListener((source, what, extra) -> {
          if (what == MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START &&
              preparedMedia == source && paused) {
            handler.post(() -> { if (preparedMedia == source && paused) player.pause(); });
          }
          return false;
        });
        if (!paused) player.start();
        else {
          // Muted start primes the first frame for feed/reel thumbnails only.
          // It must not silently play an entire clip while its card is idle.
          player.start();
          handler.postDelayed(() -> {
            if (preparedMedia == media && paused && ready) player.pause();
          }, 1100L);
        }
        emitProgress();
      });
      player.setOnCompletionListener(media -> {
        completed=true;
        player.setKeepScreenOn(false);
        final int completedDuration=Math.max(0,player.getDuration());
        // Android VideoView may clear its Surface at EOS. Keep the last decoded
        // frame visible for the Reel's Replay state (also safe for Stories).
        if (completedDuration>500 && ready) {
          player.seekTo(completedDuration-250);
          player.pause();
        }
        if(getId()>0 && getContext() instanceof ThemedReactContext){
          WritableMap event=Arguments.createMap();
          event.putDouble("durationMs",completedDuration);
          ((ThemedReactContext)getContext()).getJSModule(RCTEventEmitter.class)
            .receiveEvent(getId(),"topPlaybackComplete",event);
        }
      });
      player.setOnErrorListener((media,what,extra)->{
        ready=false;
        player.setKeepScreenOn(false);
        if(getId()>0 && getContext() instanceof ThemedReactContext){
          WritableMap event=Arguments.createMap();
          event.putString("message","Lecture de la vidéo indisponible.");
          ((ThemedReactContext)getContext()).getJSModule(RCTEventEmitter.class)
            .receiveEvent(getId(),"topPlaybackError",event);
        }
        // Never show the native Android system playback-error dialog.
        return true;
      });
      addView(player);
    }
    @Override protected void onAttachedToWindow() {
      super.onAttachedToWindow();
      handler.removeCallbacks(ticker);
      handler.post(ticker);
    }
    void setSourceUri(String uri) {
      if (uri == null || uri.equals(currentUri)) return;
      currentUri=uri;
      completed=false;
      ready=false;
      preparedMedia=null;
      seekToMs=-1;
      // Stream only known published KnowMe attachments over TLS. Never accept
      // arbitrary remote URLs or URL user-info/query/fragment from post data.
      Uri parsed = Uri.parse(uri);
      if ("https".equalsIgnoreCase(parsed.getScheme())) {
        List<String> parts = parsed.getPathSegments();
        if (!"31-56-85-53.sslip.io".equalsIgnoreCase(parsed.getHost())
            || parsed.getPort()!=-1 || parsed.getUserInfo()!=null
            || parsed.getQuery()!=null || parsed.getFragment()!=null
            || parts.size()!=5 || !"knowme-api".equals(parts.get(0))
            || !"media".equals(parts.get(1)) || !"public".equals(parts.get(2))
            || !"post".equals(parts.get(3))
            || !parts.get(4).matches("[A-Za-z0-9_-]{1,128}")) return;
        // Native VideoView/MediaPlayer issues incremental HTTPS range reads and
        // supports seeking. No unbounded MP4 is written into app cache.
        player.setVideoURI(parsed);
        player.requestFocus();
        return;
      }
      if (!"file".equalsIgnoreCase(parsed.getScheme())) return;
      try {
        File path = new File(parsed.getPath()).getCanonicalFile();
        File cache = getContext().getCacheDir().getCanonicalFile();
        // Only explicit public video saves in our private documents folder
        // are permitted outside the existing temporary story cache.
        File offline = new File(getContext().getFilesDir(),
          "knowme-offline-videos").getCanonicalFile();
        boolean temporaryStory = path.getPath().startsWith(cache.getPath()+File.separator);
        boolean savedVideo = offline.equals(path.getParentFile()) &&
          path.getName().matches("[A-Za-z0-9_-]{1,128}\\.mp4");
        if (!(temporaryStory||savedVideo) || !path.exists() || path.length()<1024L) return;
        player.setVideoPath(path.getAbsolutePath());
        player.requestFocus();
      } catch (IOException | NullPointerException ignored) {
      }
    }
    void release() {
      handler.removeCallbacks(ticker);
      ready=false;
      completed=false;
      preparedMedia=null;
      player.setKeepScreenOn(false);
      player.stopPlayback();
    }
    @Override protected void onDetachedFromWindow() {
      release();
      super.onDetachedFromWindow();
    }
  }
}
