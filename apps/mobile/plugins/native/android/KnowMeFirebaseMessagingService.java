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
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/** FCM is a wake-up signal, never a source of APK files or executable commands.
 * The user opens KnowMe, which verifies the release manifest and APK itself. */
public final class KnowMeFirebaseMessagingService extends FirebaseMessagingService {
  private static final int NOTIFICATION_ID = 11705;
  private static final String CHANNEL = "knowme_app_updates";

  @Override
  public void onMessageReceived(@NonNull RemoteMessage message) {
    if (!"knowme_android_update".equals(message.getData().get("type"))) return;
    String version = message.getData().get("version");
    String code = message.getData().get("versionCode");
    if (version == null || !version.matches("[0-9]+\\.[0-9]+\\.[0-9]+") ||
        code == null || !code.matches("[0-9]{1,10}")) return;

    long target;
    try {
      target = Long.parseLong(code);
      PackageInfo installed = getPackageManager().getPackageInfo(getPackageName(), 0);
      long current = Build.VERSION.SDK_INT >= 28
        ? installed.getLongVersionCode() : installed.versionCode;
      if (target <= current || target > Integer.MAX_VALUE) return;
    } catch (Exception ignored) {
      return;
    }

    if (Build.VERSION.SDK_INT >= 33 &&
      ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
        PackageManager.PERMISSION_GRANTED) return;

    Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
    if (launch == null) return;
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent click = PendingIntent.getActivity(this, 11705, launch,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

    NotificationManager manager =
      (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (Build.VERSION.SDK_INT >= 26) {
      NotificationChannel channel = new NotificationChannel(
        CHANNEL, "Mises à jour KnowMe", NotificationManager.IMPORTANCE_DEFAULT);
      manager.createNotificationChannel(channel);
    }
    NotificationCompat.Builder notification = new NotificationCompat.Builder(this, CHANNEL)
      .setSmallIcon(com.knowme.app.R.drawable.knowme_notification_icon)
      .setContentTitle("KnowMe " + version + " est disponible")
      .setContentText("Appuie pour ouvrir KnowMe et installer la nouvelle version.")
      .setContentIntent(click)
      .setAutoCancel(true)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT);
    manager.notify(NOTIFICATION_ID, notification.build());
  }
}
