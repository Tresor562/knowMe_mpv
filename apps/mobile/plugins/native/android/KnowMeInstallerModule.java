package com.knowme.app.updates;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import androidx.core.content.ContextCompat;
import androidx.core.app.ActivityCompat;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import java.io.File;
import java.io.FileInputStream;
import java.security.MessageDigest;
import java.util.Locale;

public final class KnowMeInstallerModule extends ReactContextBaseJavaModule {
  private final ReactApplicationContext context;

  public KnowMeInstallerModule(ReactApplicationContext context) {
    super(context);
    this.context = context;
  }

  @Override
  public String getName() {
    return "KnowMeApkInstaller";
  }

  private long versionCode(PackageInfo info) {
    return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
  }

  @ReactMethod
  public void startUpdateWatcher(Promise promise) {
    try {
      // WorkManager persists the 15-minute check even while KnowMe is closed.
      KnowMeUpdateWorker.schedule(context);
      if (Build.VERSION.SDK_INT >= 33 &&
          ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED) {
        android.content.SharedPreferences prefs = context.getSharedPreferences(
          "knowme_update_notifications", android.content.Context.MODE_PRIVATE);
        if (!prefs.getBoolean("notification_permission_requested", false)) {
          Activity activity = getCurrentActivity();
          if (activity != null) {
            prefs.edit().putBoolean("notification_permission_requested", true).apply();
            ActivityCompat.requestPermissions(
              activity, new String[] { Manifest.permission.POST_NOTIFICATIONS }, 11705);
          }
        }
      }
      promise.resolve(true);
    } catch (Exception error) {
      promise.reject("UPDATE_WATCH_UNAVAILABLE", "Surveillance des mises à jour indisponible.", error);
    }
  }

  @ReactMethod
  public void getInstalledVersionCode(Promise promise) {
    try {
      PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
      promise.resolve((double) versionCode(info));
    } catch (Exception error) {
      promise.reject("VERSION_UNAVAILABLE", "Impossible de lire la version installée.", error);
    }
  }

  @ReactMethod
  public void installApk(String uri, String sha256, double targetVersion, Promise promise) {
    try {
      if (sha256 == null || !sha256.matches("(?i)[a-f0-9]{64}")) {
        promise.reject("INVALID_DIGEST", "Empreinte SHA-256 manquante.");
        return;
      }
      if (!Double.isFinite(targetVersion) || targetVersion < 1 || targetVersion != Math.floor(targetVersion)) {
        promise.reject("INVALID_VERSION", "Version cible invalide.");
        return;
      }
      Uri parsed = Uri.parse(uri);
      if (!"file".equals(parsed.getScheme())) {
        promise.reject("INVALID_PATH", "Le fichier doit provenir du cache privé de KnowMe.");
        return;
      }
      File file = new File(parsed.getPath()).getCanonicalFile();
      File cache = context.getCacheDir().getCanonicalFile();
      if (!file.getPath().startsWith(cache.getPath() + File.separator) ||
          !file.getName().endsWith(".apk") || !file.isFile()) {
        promise.reject("INVALID_PATH", "APK absent du cache privé de KnowMe.");
        return;
      }
      if (file.length() < 1_000_000L || file.length() > 500_000_000L) {
        promise.reject("INVALID_SIZE", "Taille du fichier APK inattendue.");
        return;
      }
      MessageDigest hash = MessageDigest.getInstance("SHA-256");
      try (FileInputStream in = new FileInputStream(file)) {
        byte[] bytes = new byte[64 * 1024];
        int count;
        while ((count = in.read(bytes)) != -1) hash.update(bytes, 0, count);
      }
      StringBuilder digest = new StringBuilder();
      for (byte b : hash.digest()) digest.append(String.format(Locale.ROOT, "%02x", b & 0xff));
      if (!digest.toString().equalsIgnoreCase(sha256)) {
        promise.reject("DIGEST_MISMATCH", "La vérification de sécurité de l'APK a échoué.");
        return;
      }

      PackageManager packageManager = context.getPackageManager();
      PackageInfo apk = packageManager.getPackageArchiveInfo(file.getAbsolutePath(), 0);
      PackageInfo installed = packageManager.getPackageInfo(context.getPackageName(), 0);
      if (apk == null || !context.getPackageName().equals(apk.packageName) ||
          versionCode(apk) != (long) targetVersion ||
          versionCode(apk) <= versionCode(installed)) {
        promise.reject("INCOMPATIBLE_APK", "APK incorrect ou version non supérieure à celle installée.");
        return;
      }

      if (Build.VERSION.SDK_INT >= 26 && !packageManager.canRequestPackageInstalls()) {
        Intent settings = new Intent(
          Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
          Uri.parse("package:" + context.getPackageName())
        );
        settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(settings);
        promise.reject("INSTALL_PERMISSION_REQUIRED",
          "Autorise KnowMe à installer ses mises à jour, puis appuie de nouveau sur Mettre à jour.");
        return;
      }

      Uri contentUri = FileProvider.getUriForFile(
        context,
        context.getPackageName() + ".knowme.updates",
        file
      );
      Intent install = new Intent(Intent.ACTION_VIEW);
      install.setDataAndType(contentUri, "application/vnd.android.package-archive");
      install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
      context.startActivity(install);
      promise.resolve(true);
    } catch (Exception error) {
      promise.reject("INSTALL_FAILED", "Impossible de lancer l'installation Android.", error);
    }
  }
}
