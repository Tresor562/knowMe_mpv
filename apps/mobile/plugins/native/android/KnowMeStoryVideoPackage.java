package com.knowme.app.video;

import android.content.Context;
import android.media.AudioManager;
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
      // A paused preview must not indefinitely keep the whole device awake.
      view.player.setKeepScreenOn(!paused && view.ready);
      if (view.ready) {
        if (paused) view.player.pause();
        else view.player.start();
      }
    }

    @ReactProp(name="nativeControls", defaultBoolean=true)
    public void nativeControls(StoryContainer view, boolean enabled) {
      view.setNativeControls(enabled);
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
      if (duration>0) player.seekTo((int)Math.min(seekToMs, duration));
      seekToMs=-1;
      emitProgress();
    }
    StoryContainer(Context context) {
      super(context);
      player = new VideoView(context);
      player.setLayoutParams(new LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT));
      player.setKeepScreenOn(false);
      // KnowMe renders its own accessible controls: never attach the Android
      // MediaController, which leaks transport overlays onto feed thumbnails.
      player.setMediaController(null);
      player.setOnPreparedListener(media -> {
        ready=true;
        media.setLooping(false);
        player.setKeepScreenOn(!paused);
        applySeek();
        if (!paused) player.start();
        emitProgress();
      });
      player.setOnCompletionListener(media -> {
        player.setKeepScreenOn(false);
        if(getId()>0 && getContext() instanceof ThemedReactContext){
          WritableMap event=Arguments.createMap();
          event.putDouble("durationMs",Math.max(0,player.getDuration()));
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
      ready=false;
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
      player.setKeepScreenOn(false);
      player.stopPlayback();
    }
    @Override protected void onDetachedFromWindow() {
      release();
      super.onDetachedFromWindow();
    }
  }
}
