package com.knowme.app.updates;

import android.Manifest;
import android.app.DownloadManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/** Android notifies KnowMe when a user-authorized APK download completes.
 * This receiver NEVER launches an installer or reads other applications' files:
 * opening the notification returns to KnowMe for SHA/package/version validation.
 */
public final class KnowMeUpdateDownloadReceiver extends BroadcastReceiver {
  private static final String CHANNEL = "knowme_app_updates";
  private static final int NOTIFICATION_ID = 11706;

  @Override
  public void onReceive(Context context, Intent intent) {
    if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;
    SharedPreferences prefs = context.getSharedPreferences(
      "knowme_background_apk", Context.MODE_PRIVATE);
    long id = prefs.getLong("id", -1);
    if (id < 1 || intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1) != id) return;
    DownloadManager manager =
      (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
    try (Cursor cursor = manager.query(new DownloadManager.Query().setFilterById(id))) {
      if (cursor == null || !cursor.moveToFirst() ||
          cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            != DownloadManager.STATUS_SUCCESSFUL) return;
    } catch (Exception error) {
      return;
    }
    if (Build.VERSION.SDK_INT >= 33 &&
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
          != PackageManager.PERMISSION_GRANTED) return;
    Intent launch = context.getPackageManager()
      .getLaunchIntentForPackage(context.getPackageName());
    if (launch == null) return;
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent tap = PendingIntent.getActivity(context, NOTIFICATION_ID, launch,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    NotificationManager notifications =
      (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (Build.VERSION.SDK_INT >= 26) {
      NotificationChannel channel = new NotificationChannel(
        CHANNEL, "Mises à jour KnowMe", NotificationManager.IMPORTANCE_DEFAULT);
      channel.setDescription("Téléchargements et installation des mises à jour KnowMe.");
      notifications.createNotificationChannel(channel);
    }
    notifications.notify(NOTIFICATION_ID, new NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(com.knowme.app.R.drawable.knowme_notification_icon)
      .setContentTitle("Mise à jour KnowMe téléchargée")
      .setContentText("Appuie pour vérifier l'APK et autoriser son installation.")
      .setContentIntent(tap)
      .setAutoCancel(true)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .build());
  }
}
