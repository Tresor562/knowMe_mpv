package com.knowme.app.video;

import android.content.Context;
import android.media.AudioManager;
import android.net.Uri;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.MediaController;
import android.widget.VideoView;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.ReactPackage;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewManager;
import com.facebook.react.uimanager.annotations.ReactProp;
import java.io.File;
import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

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
      if (paused) view.player.pause();
      else if (view.ready) view.player.start();
    }

    @Override public void onDropViewInstance(StoryContainer view) {
      view.release();
      super.onDropViewInstance(view);
    }
  }

  public static final class StoryContainer extends FrameLayout {
    final VideoView player;
    boolean ready = false;
    String currentUri = "";
    StoryContainer(Context context) {
      super(context);
      player = new VideoView(context);
      player.setLayoutParams(new LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT));
      player.setKeepScreenOn(true);
      MediaController controller = new MediaController(context);
      controller.setAnchorView(player);
      player.setMediaController(controller);
      player.setOnPreparedListener(media -> {
        ready=true;
        media.setLooping(false);
        player.start();
      });
      player.setOnErrorListener((media,what,extra)->{
        ready=false;
        return false;
      });
      addView(player);
    }
    void setSourceUri(String uri) {
      if (uri == null || uri.equals(currentUri)) return;
      currentUri=uri;
      ready=false;
      if (!uri.startsWith("file://")) return;
      try {
        File path = new File(Uri.parse(uri).getPath()).getCanonicalFile();
        File cache = getContext().getCacheDir().getCanonicalFile();
        if (!path.getPath().startsWith(cache.getPath() + File.separator)
            || !path.exists() || path.length()<1024L) return;
        player.setVideoPath(path.getAbsolutePath());
        player.requestFocus();
      } catch (IOException ignored) {
      }
    }
    void release() {
      ready=false;
      player.stopPlayback();
    }
    @Override protected void onDetachedFromWindow() {
      release();
      super.onDetachedFromWindow();
    }
  }
}
