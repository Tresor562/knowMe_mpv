package com.knowme.app.updates;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import androidx.work.WorkManager;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/** Checks the first-party immutable-preview feed while KnowMe is closed.
 * No downloads or installations occur in background: the notification only
 * reopens KnowMe, where its existing verified APK installer handles consent. */
public final class KnowMeUpdateWorker extends Worker {
  private static final String FEED = "https://31-56-85-53.sslip.io/knowme-api/mobile-updates/android";
  private static final String CHANNEL = "knowme_app_updates";
  private static final String WORK = "knowme-periodic-verified-update-check";
  private static final String PREFS = "knowme_update_notifications";
  private static final int NOTIFICATION_ID = 11705;

  public KnowMeUpdateWorker(@NonNull Context context, @NonNull WorkerParameters params) {
    super(context, params);
  }

  public static void schedule(Context context) {
    Constraints constraints = new Constraints.Builder()
      .setRequiredNetworkType(NetworkType.CONNECTED)
      .build();
    PeriodicWorkRequest job = new PeriodicWorkRequest.Builder(
      KnowMeUpdateWorker.class, 15, TimeUnit.MINUTES
    ).setConstraints(constraints).build();
    WorkManager.getInstance(context.getApplicationContext()).enqueueUniquePeriodicWork(
      WORK, ExistingPeriodicWorkPolicy.KEEP, job
    );
  }

  private long installedVersion() throws Exception {
    Context context = getApplicationContext();
    PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
    return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
  }

  private JSONObject fetchRelease() throws Exception {
    HttpURLConnection connection = (HttpURLConnection) new URL(FEED).openConnection();
    connection.setConnectTimeout(6500);
    connection.setReadTimeout(6500);
    connection.setRequestProperty("Accept", "application/json");
    try {
      if (connection.getResponseCode() != 200) return null;
      StringBuilder body = new StringBuilder();
      try (BufferedReader in = new BufferedReader(
        new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
        String line;
        while ((line = in.readLine()) != null) {
          body.append(line);
          if (body.length() > 8192) return null;
        }
      }
      return new JSONObject(body.toString()).optJSONObject("release");
    } finally {
      connection.disconnect();
    }
  }

  @Override @NonNull
  public Result doWork() {
    try {
      JSONObject release = fetchRelease();
      if (release == null) return Result.success();
      long current = installedVersion();
      long next = release.optLong("versionCode", 0);
      String version = release.optString("version", "");
      String digest = release.optString("sha256", "");
      String url = release.optString("url", "");
      if (next <= current || next <= 0) {
        ((NotificationManager) getApplicationContext()
          .getSystemService(Context.NOTIFICATION_SERVICE)).cancel(NOTIFICATION_ID);
        return Result.success();
      }
      if (!version.matches("[0-9]+\\.[0-9]+\\.[0-9]+") ||
          !digest.matches("(?i)[a-f0-9]{64}") ||
          !url.equals("https://31-56-85-53.sslip.io/knowme-api/mobile-updates/android/apk/KnowMe-" +
            version + "-preview.apk")) {
        return Result.success();
      }
      Context context = getApplicationContext();
      if (Build.VERSION.SDK_INT >= 33 &&
          ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED) return Result.success();

      long last = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .getLong("last_notified_version_code", 0);
      if (last >= next) return Result.success();
      Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
      if (launch == null) return Result.success();
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      PendingIntent tap = PendingIntent.getActivity(context, 11705, launch,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

      NotificationManager manager = (NotificationManager)
        context.getSystemService(Context.NOTIFICATION_SERVICE);
      if (Build.VERSION.SDK_INT >= 26) {
        NotificationChannel channel = new NotificationChannel(
          CHANNEL, "Mises à jour KnowMe", NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("Préviens lorsqu'une nouvelle APK KnowMe compatible est disponible.");
        manager.createNotificationChannel(channel);
      }
      NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL)
        .setSmallIcon(com.knowme.app.R.drawable.knowme_notification_icon)
        .setContentTitle("KnowMe " + version + " est disponible")
        .setContentText("Appuie ici pour mettre à jour KnowMe directement dans l'application.")
        .setContentIntent(tap)
        .setAutoCancel(true)
        .setOnlyAlertOnce(true)
        .setPriority(NotificationCompat.PRIORITY_DEFAULT);
      manager.notify(NOTIFICATION_ID, notification.build());
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit().putLong("last_notified_version_code", next).apply();
      return Result.success();
    } catch (Exception unavailable) {
      // No spurious alerts or crashes if mobile data, HTTPS or the feed fails.
      return Result.retry();
    }
  }
}
