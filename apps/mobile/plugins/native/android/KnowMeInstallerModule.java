package com.knowme.app.updates;

import android.Manifest;
import android.app.DownloadManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import androidx.core.content.ContextCompat;
import androidx.core.app.ActivityCompat;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.security.MessageDigest;
import java.util.Locale;

public final class KnowMeInstallerModule extends ReactContextBaseJavaModule {
  private final ReactApplicationContext context;
  private static final String BACKGROUND_PREFS = "knowme_background_apk";
  private static final String TRUSTED_APK =
    "https://31-56-85-53\\.sslip\\.io/knowme-api/mobile-updates/android/apk/" +
    "KnowMe-[0-9]+\\.[0-9]+\\.[0-9]+-preview\\.apk";

  private SharedPreferences backgroundPrefs() {
    return context.getSharedPreferences(BACKGROUND_PREFS, Context.MODE_PRIVATE);
  }

  private DownloadManager downloadManager() {
    return (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
  }

  private int downloadState(long id) {
    if (id < 1) return -1;
    try (Cursor cursor = downloadManager().query(
      new DownloadManager.Query().setFilterById(id))) {
      if (cursor == null || !cursor.moveToFirst()) return -1;
      return cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
    } catch (Exception error) {
      return -1;
    }
  }

  private File backgroundFile(long target, String digest) {
    File downloads = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
    if (downloads == null) throw new IllegalStateException("Stockage Android inaccessible.");
    return new File(downloads, "knowme-update-" + target + "-" +
      digest.substring(0, 12).toLowerCase(Locale.ROOT) + ".apk");
  }

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
            activity.runOnUiThread(() ->
              ActivityCompat.requestPermissions(
                activity, new String[] { Manifest.permission.POST_NOTIFICATIONS }, 11705));
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


  // DownloadManager is owned by Android, so the APK transfer survives dismissing
  // the React modal, backgrounding the app and even process termination.
  @ReactMethod
  public void queueBackgroundUpdate(String url, String sha256, double targetVersion, Promise promise) {
    try {
      if (url == null || !url.matches(TRUSTED_APK) ||
          sha256 == null || !sha256.matches("(?i)[a-f0-9]{64}") ||
          !Double.isFinite(targetVersion) || targetVersion < 1 ||
          targetVersion != Math.floor(targetVersion)) {
        promise.reject("INVALID_RELEASE", "Métadonnées de mise à jour non fiables.");
        return;
      }
      long version = (long) targetVersion;
      PackageInfo installed = context.getPackageManager()
        .getPackageInfo(context.getPackageName(), 0);
      if (version <= versionCode(installed)) {
        promise.reject("INVALID_VERSION", "Cette version est déjà installée.");
        return;
      }
      SharedPreferences prefs = backgroundPrefs();
      long oldId = prefs.getLong("id", -1);
      int existing = downloadState(oldId);
      if (prefs.getLong("version", -1) == version &&
          sha256.equalsIgnoreCase(prefs.getString("sha256", "")) &&
          (existing == DownloadManager.STATUS_PENDING ||
           existing == DownloadManager.STATUS_RUNNING ||
           existing == DownloadManager.STATUS_PAUSED ||
           existing == DownloadManager.STATUS_SUCCESSFUL)) {
        promise.resolve(true);
        return;
      }
      if (oldId > 0) downloadManager().remove(oldId);
      File destination = backgroundFile(version, sha256);
      if (destination.exists() && !destination.delete()) {
        promise.reject("CACHE_UNAVAILABLE", "Impossible de remplacer l'ancien APK.");
        return;
      }
      DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
      request.setTitle("Mise à jour KnowMe");
      request.setDescription("Téléchargement de KnowMe en arrière-plan");
      request.setMimeType("application/vnd.android.package-archive");
      request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE);
      request.setAllowedOverMetered(true);
      request.setAllowedOverRoaming(false);
      request.setDestinationInExternalFilesDir(
        context, Environment.DIRECTORY_DOWNLOADS, destination.getName());
      long id = downloadManager().enqueue(request);
      prefs.edit().putLong("id", id).putLong("version", version)
        .putString("sha256", sha256.toLowerCase(Locale.ROOT))
        .putString("url", url).putBoolean("installationRequested", false).apply();
      promise.resolve(true);
    } catch (Exception error) {
      promise.reject("DOWNLOAD_START_FAILED", "Impossible de lancer le téléchargement Android.", error);
    }
  }

  @ReactMethod
  public void getBackgroundUpdateStatus(Promise promise) {
    try {
      WritableMap state = Arguments.createMap();
      SharedPreferences prefs = backgroundPrefs();
      long id = prefs.getLong("id", -1);
      long version = prefs.getLong("version", -1);
      String digest = prefs.getString("sha256", "");
      state.putDouble("versionCode", (double) version);
      state.putBoolean("installationRequested",
        prefs.getBoolean("installationRequested", false));
      PackageInfo installed = context.getPackageManager()
        .getPackageInfo(context.getPackageName(), 0);
      if (id < 1 || version < 1 || !digest.matches("(?i)[a-f0-9]{64}")) {
        state.putString("status", "none");
        promise.resolve(state);
        return;
      }
      // A successful installation is proved only by Android's installed version,
      // never by DownloadManager finishing or by opening the installer.
      if (version <= versionCode(installed)) {
        state.putString("status", prefs.getBoolean("installationRequested", false)
          ? "installed" : "none");
        promise.resolve(state);
        return;
      }
      try (Cursor cursor = downloadManager().query(
          new DownloadManager.Query().setFilterById(id))) {
        if (cursor == null || !cursor.moveToFirst()) {
          state.putString("status", "failed");
          promise.resolve(state);
          return;
        }
        int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
        long bytes = cursor.getLong(cursor.getColumnIndexOrThrow(
          DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
        long total = cursor.getLong(cursor.getColumnIndexOrThrow(
          DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
        state.putDouble("bytesDownloaded", (double) Math.max(0, bytes));
        // -1 = the server did not supply Content-Length. Never fabricate a percentage.
        state.putDouble("totalBytes", (double) total);
        if (status == DownloadManager.STATUS_SUCCESSFUL) {
          File file = backgroundFile(version, digest);
          state.putString("status", file.isFile() && file.length() >= 1_000_000L
            && file.length() <= 500_000_000L ? "ready" : "failed");
        } else if (status == DownloadManager.STATUS_PENDING ||
                   status == DownloadManager.STATUS_RUNNING ||
                   status == DownloadManager.STATUS_PAUSED) {
          state.putString("status", "downloading");
        } else {
          state.putString("status", "failed");
          state.putDouble("failureReason", (double) cursor.getInt(
            cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)));
        }
      }
      promise.resolve(state);
    } catch (Exception error) {
      promise.reject("DOWNLOAD_STATUS_FAILED", "Statut du téléchargement indisponible.", error);
    }
  }

  @ReactMethod
  public void acknowledgeInstalledUpdate(Promise promise) {
    try {
      SharedPreferences prefs = backgroundPrefs();
      long version = prefs.getLong("version", -1);
      PackageInfo installed = context.getPackageManager()
        .getPackageInfo(context.getPackageName(), 0);
      if (version < 1 || version > versionCode(installed) ||
          !prefs.getBoolean("installationRequested", false)) {
        promise.reject("INSTALL_NOT_CONFIRMED", "La nouvelle version n'est pas installée.");
        return;
      }
      long id = prefs.getLong("id", -1);
      String digest = prefs.getString("sha256", "");
      if (id > 0) downloadManager().remove(id);
      if (digest.matches("(?i)[a-f0-9]{64}")) {
        File oldApk = backgroundFile(version, digest);
        if (oldApk.isFile()) oldApk.delete();
      }
      prefs.edit().clear().commit();
      promise.resolve(true);
    } catch (Exception error) {
      promise.reject("INSTALL_ACK_FAILED", "Impossible de confirmer la mise à jour.", error);
    }
  }

  @ReactMethod
  public void installBackgroundUpdate(Promise promise) {
    try {
      SharedPreferences prefs = backgroundPrefs();
      long id = prefs.getLong("id", -1);
      long version = prefs.getLong("version", -1);
      String digest = prefs.getString("sha256", "");
      if (downloadState(id) != DownloadManager.STATUS_SUCCESSFUL ||
          !digest.matches("(?i)[a-f0-9]{64}") || version < 1) {
        promise.reject("DOWNLOAD_NOT_READY", "Le téléchargement n'est pas terminé.");
        return;
      }
      File source = backgroundFile(version, digest).getCanonicalFile();
      File external = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS).getCanonicalFile();
      if (!source.getParentFile().equals(external) || !source.isFile() ||
          source.length() < 1_000_000L || source.length() > 500_000_000L) {
        promise.reject("INVALID_PATH", "Fichier APK absent du stockage privé.");
        return;
      }
      // The existing installer accepts only cache://file paths. Copy on a
      // deliberate user action, then let it verify SHA-256, package and version.
      File local = new File(context.getCacheDir(), "knowme-update-" + version + ".apk");
      try (FileInputStream in = new FileInputStream(source);
           FileOutputStream out = new FileOutputStream(local)) {
        byte[] buffer = new byte[64 * 1024];
        int n;
        while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
      }
      installApk(Uri.fromFile(local).toString(), digest, (double) version, promise);
    } catch (Exception error) {
      promise.reject("INSTALL_PREP_FAILED", "Impossible de préparer l'installation Android.", error);
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
      SharedPreferences prefs = backgroundPrefs();
      if (prefs.getLong("version", -1) == (long) targetVersion &&
          downloadState(prefs.getLong("id", -1)) == DownloadManager.STATUS_SUCCESSFUL) {
        // Keep this receipt across app replacement; a new APK confirms completion
        // only after Android reports that the version has actually changed.
        prefs.edit().putBoolean("installationRequested", true).commit();
      }
      promise.resolve(true);
    } catch (Exception error) {
      promise.reject("INSTALL_FAILED", "Impossible de lancer l'installation Android.", error);
    }
  }
}
