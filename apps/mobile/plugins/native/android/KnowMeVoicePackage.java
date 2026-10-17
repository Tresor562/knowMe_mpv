package com.knowme.app.voice;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.MediaPlayer;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.ViewManager;
import java.io.File;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/** Record mono Ogg/Opus voice notes into private app cache.
 * Android 10+ only. No microphone access without explicit runtime permission.
 * Files are never uploaded by the native module: the JS messaging pathway
 * must explicitly confirm and authorize the associated conversation.
 */
public final class KnowMeVoicePackage implements ReactPackage {
  @Override public List<NativeModule> createNativeModules(ReactApplicationContext context) {
    return Collections.<NativeModule>singletonList(new VoiceModule(context));
  }
  @Override public List<ViewManager> createViewManagers(ReactApplicationContext context) {
    return Collections.emptyList();
  }

  public static final class VoiceModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext context;
    private MediaRecorder recorder;
    private MediaPlayer player;
    private String playbackUri;
    private File currentFile;
    private long startedAt;

    VoiceModule(ReactApplicationContext context) {
      super(context);
      this.context = context;
    }
    @Override public String getName() { return "KnowMeVoice"; }

    @ReactMethod public synchronized void start(Promise promise) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        promise.reject("VOICE_ANDROID_VERSION", "Les notes vocales Ogg nécessitent Android 10 ou plus.");
        return;
      }
      if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO)
          != PackageManager.PERMISSION_GRANTED) {
        promise.reject("VOICE_PERMISSION", "Autorisation microphone nécessaire.");
        return;
      }
      if (recorder != null) {
        promise.reject("VOICE_ALREADY_RECORDING", "Enregistrement déjà en cours.");
        return;
      }
      stopPlaybackQuietly();
      File directory = new File(context.getCacheDir(), "knowme-voice");
      if (!directory.exists() && !directory.mkdirs()) {
        promise.reject("VOICE_CACHE", "Cache privé indisponible."); return;
      }
      currentFile = new File(directory, "voice-" + UUID.randomUUID() + ".ogg");
      try {
        recorder = new MediaRecorder();
        recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
        recorder.setOutputFormat(MediaRecorder.OutputFormat.OGG);
        recorder.setAudioEncoder(MediaRecorder.AudioEncoder.OPUS);
        recorder.setAudioChannels(1);
        recorder.setAudioSamplingRate(48000);
        recorder.setAudioEncodingBitRate(32000);
        recorder.setMaxDuration(60000);
        recorder.setOutputFile(currentFile.getAbsolutePath());
        recorder.prepare();
        recorder.start();
        startedAt = SystemClock.elapsedRealtime();
        promise.resolve(true);
      } catch (Exception error) {
        releaseRecorder();
        discard();
        promise.reject("VOICE_START_FAILED", "Microphone ou encodeur Ogg indisponible.", error);
      }
    }

    @ReactMethod public synchronized void stop(Promise promise) {
      if (recorder == null || currentFile == null) {
        promise.reject("VOICE_NOT_RECORDING", "Aucun enregistrement en cours."); return;
      }
      long duration = Math.min(60000L, SystemClock.elapsedRealtime() - startedAt);
      File completed = currentFile;
      try {
        recorder.stop();
        releaseRecorder();
        if (duration < 700 || !completed.isFile() || completed.length() < 1024) {
          discard();
          promise.reject("VOICE_TOO_SHORT", "Maintiens le micro au moins une seconde.");
          return;
        }
        WritableMap result = Arguments.createMap();
        result.putString("uri", Uri.fromFile(completed).toString());
        result.putString("name", completed.getName());
        result.putString("mime", "audio/ogg");
        result.putDouble("durationMs", duration);
        result.putDouble("size", completed.length());
        currentFile = null;
        promise.resolve(result);
      } catch (Exception error) {
        releaseRecorder();
        discard();
        promise.reject("VOICE_STOP_FAILED", "Impossible de finaliser cet enregistrement.", error);
      }
    }

    @ReactMethod public synchronized void cancel(Promise promise) {
      if (recorder != null) {
        try { recorder.stop(); } catch (RuntimeException ignored) {}
        releaseRecorder();
      }
      discard();
      promise.resolve(true);
    }

    @ReactMethod public synchronized void play(String uri, Promise promise) {
      stopPlaybackQuietly();
      try {
        File file = allowedFile(uri);
        player = new MediaPlayer();
        playbackUri = Uri.fromFile(file).toString();
        player.setDataSource(file.getAbsolutePath());
        player.setOnCompletionListener(completed -> stopPlaybackQuietly());
        player.prepare();
        player.start();
        promise.resolve(true);
      } catch (Exception error) {
        stopPlaybackQuietly();
        promise.reject("VOICE_PLAY_FAILED", "Prévisualisation audio impossible.", error);
      }
    }

    /** Playback metadata for the inline chat player; never exposes arbitrary device files. */
    @ReactMethod public synchronized void playbackStatus(Promise promise) {
      WritableMap status = Arguments.createMap();
      try {
        status.putBoolean("playing", player != null && player.isPlaying());
        status.putInt("durationMs", player == null ? 0 : player.getDuration());
        status.putInt("positionMs", player == null ? 0 : player.getCurrentPosition());
        status.putString("uri", playbackUri);
        promise.resolve(status);
      } catch (Exception error) {
        promise.reject("VOICE_STATUS_FAILED", "Lecture audio momentanément indisponible.", error);
      }
    }

    @ReactMethod public synchronized void seekPlayback(int positionMs, Promise promise) {
      if (player == null) {
        promise.reject("VOICE_NOT_PLAYING", "Aucun audio en cours de lecture.");
        return;
      }
      try {
        player.seekTo(Math.max(0, Math.min(positionMs, player.getDuration())));
        promise.resolve(true);
      } catch (Exception error) {
        promise.reject("VOICE_SEEK_FAILED", "Déplacement audio impossible.", error);
      }
    }

    @ReactMethod public synchronized void stopPlayback(Promise promise) {
      stopPlaybackQuietly();
      promise.resolve(true);
    }

    @ReactMethod public synchronized void discardFile(String uri, Promise promise) {
      try {
        File file = allowedFile(uri);
        stopPlaybackQuietly();
        if (file.exists() && !file.delete()) throw new IllegalStateException("Cache non supprimé");
        promise.resolve(true);
      } catch (Exception error) {
        promise.reject("VOICE_DISCARD_FAILED", "Nettoyage de la note vocale impossible.", error);
      }
    }

    private File allowedFile(String uri) throws Exception {
      if (uri == null || !uri.startsWith("file://")) throw new SecurityException("URI invalide");
      File file = new File(Uri.parse(uri).getPath()).getCanonicalFile();
      File directory = new File(context.getCacheDir(), "knowme-voice").getCanonicalFile();
      if (!file.getParentFile().equals(directory) || !file.getName().endsWith(".ogg") || !file.isFile())
        throw new SecurityException("Le fichier doit appartenir au cache vocal KnowMe.");
      return file;
    }
    private void releaseRecorder() {
      if (recorder != null) {
        try { recorder.reset(); } catch (Exception ignored) {}
        try { recorder.release(); } catch (Exception ignored) {}
        recorder = null;
      }
      startedAt = 0;
    }
    private void stopPlaybackQuietly() {
      playbackUri = null;
      if (player == null) return;
      try { player.stop(); } catch (Exception ignored) {}
      try { player.release(); } catch (Exception ignored) {}
      player = null;
    }
    private void discard() {
      if (currentFile != null && currentFile.exists()) currentFile.delete();
      currentFile = null;
      startedAt = 0;
    }
    @Override public synchronized void invalidate() {
      releaseRecorder();
      discard();
      stopPlaybackQuietly();
      super.invalidate();
    }
  }
}
