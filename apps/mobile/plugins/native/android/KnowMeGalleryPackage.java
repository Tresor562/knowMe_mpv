package com.knowme.app.gallery;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Size;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.BaseActivityEventListener;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.ViewManager;
import java.io.File;
import java.io.FileOutputStream;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Scoped MediaStore gallery and Android ACTION_OPEN_DOCUMENT picker.
 * No broad filesystem traversal and no access without Android's runtime permission.
 */
public final class KnowMeGalleryPackage implements ReactPackage {
  @Override public List<NativeModule> createNativeModules(ReactApplicationContext context) {
    return Collections.<NativeModule>singletonList(new GalleryModule(context));
  }
  @Override public List<ViewManager> createViewManagers(ReactApplicationContext context) {
    return Collections.emptyList();
  }

  public static final class GalleryModule extends ReactContextBaseJavaModule {
    private static final int PICK_FILES = 52734;
    private static final int PAGE_LIMIT = 60;
    private final ReactApplicationContext context;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private Promise pickerPromise;

    GalleryModule(ReactApplicationContext reactContext) {
      super(reactContext);
      context = reactContext;
      context.addActivityEventListener(new BaseActivityEventListener() {
        @Override public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
          if (requestCode != PICK_FILES) return;
          Promise result = pickerPromise;
          pickerPromise = null;
          if (result == null) return;
          if (resultCode != Activity.RESULT_OK || data == null) {
            result.resolve(Arguments.createArray()); return;
          }
          WritableArray selected = Arguments.createArray();
          try {
            if (data.getClipData() != null) {
              int count = Math.min(10, data.getClipData().getItemCount());
              for (int i = 0; i < count; i++) {
                selected.pushMap(fileDetail(data.getClipData().getItemAt(i).getUri()));
              }
            } else if (data.getData() != null) {
              selected.pushMap(fileDetail(data.getData()));
            }
            result.resolve(selected);
          } catch (Exception failure) {
            result.reject("FILES_READ_FAILED", "Impossible de lire les fichiers sélectionnés.", failure);
          }
        }
      });
    }

    @Override public String getName() { return "KnowMeGallery"; }

    @ReactMethod public void listMedia(String filter, String album, int offset, int count, Promise promise) {
      final String mode = filter == null ? "all" : filter;
      final String bucket = album == null ? "" : album;
      if (!mode.equals("all") && !mode.equals("photo") && !mode.equals("video")) {
        promise.reject("FILTER_INVALID", "Filtre galerie non pris en charge."); return;
      }
      if (offset < 0 || offset > 30000 || count < 1 || count > PAGE_LIMIT) {
        promise.reject("PAGE_INVALID", "Pagination galerie invalide."); return;
      }
      worker.execute(() -> {
        try {
          ContentResolver resolver = context.getContentResolver();
          Uri source = MediaStore.Files.getContentUri("external");
          String mediaType = MediaStore.Files.FileColumns.MEDIA_TYPE;
          String bucketColumn = "bucket_id";
          String selection = mode.equals("photo")
            ? mediaType + " = ?"
            : mode.equals("video") ? mediaType + " = ?" : mediaType + " IN (?, ?)";
          java.util.ArrayList<String> args = new java.util.ArrayList<>();
          if (mode.equals("photo")) args.add(String.valueOf(MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE));
          else if (mode.equals("video")) args.add(String.valueOf(MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO));
          else {
            args.add(String.valueOf(MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE));
            args.add(String.valueOf(MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO));
          }
          if (!bucket.isEmpty()) {
            selection += " AND " + bucketColumn + " = ?";
            args.add(bucket);
          }
          // Bounded native query, not a scan of all files in app JavaScript memory.
          String order = MediaStore.MediaColumns.DATE_ADDED + " DESC, "
            + MediaStore.MediaColumns._ID + " DESC LIMIT " + count + " OFFSET " + offset;
          String[] cols = {
            MediaStore.MediaColumns._ID,
            MediaStore.MediaColumns.MIME_TYPE,
            MediaStore.MediaColumns.DISPLAY_NAME,
            MediaStore.MediaColumns.DATE_ADDED,
            MediaStore.MediaColumns.BUCKET_ID,
            "bucket_display_name",
            MediaStore.Files.FileColumns.MEDIA_TYPE
          };
          WritableArray items = Arguments.createArray();
          try (Cursor cursor = resolver.query(source, cols, selection,
              args.toArray(new String[0]), order)) {
            if (cursor == null) throw new IllegalStateException("MediaStore non disponible");
            while (cursor.moveToNext()) {
              long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID));
              int type = cursor.getInt(cursor.getColumnIndexOrThrow(mediaType));
              boolean video = type == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO;
              Uri uri = ContentUris.withAppendedId(
                video ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                      : MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
              String name = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME));
              String mime = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.MIME_TYPE));
              WritableMap asset = Arguments.createMap();
              asset.putString("id", (video ? "v" : "i") + id);
              asset.putString("uri", uri.toString());
              asset.putString("name", name == null ? (video ? "video.mp4" : "photo.jpg") : name);
              asset.putString("mime", mime == null ? (video ? "video/mp4" : "image/jpeg") : mime);
              asset.putString("type", video ? "video" : "photo");
              String bucketId = cursor.getString(cursor.getColumnIndexOrThrow(bucketColumn));
              String albumName = cursor.getString(cursor.getColumnIndexOrThrow("bucket_display_name"));
              asset.putString("albumId", bucketId == null ? "" : bucketId);
              asset.putString("albumName", albumName == null ? "Autres" : albumName);
              asset.putDouble("timestamp", cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_ADDED)));
              asset.putString("thumbnail", thumbnail(resolver, uri, id, video));
              items.pushMap(asset);
            }
          }
          promise.resolve(items);
        } catch (SecurityException permission) {
          promise.reject("GALLERY_PERMISSION", "Autorisation de photos et vidéos nécessaire.", permission);
        } catch (Exception failure) {
          promise.reject("GALLERY_UNAVAILABLE", "Lecture de la galerie impossible.", failure);
        }
      });
    }

    private String thumbnail(ContentResolver resolver, Uri uri, long id, boolean video) {
      if (!video) return uri.toString();
      File directory = new File(context.getCacheDir(), "knowme-gallery-thumbs");
      if (!directory.exists() && !directory.mkdirs()) return "";
      File thumbnail = new File(directory, "video-" + id + ".jpg");
      if (thumbnail.exists() && thumbnail.length() > 100) return Uri.fromFile(thumbnail).toString();
      Bitmap bitmap = null;
      try {
        if (Build.VERSION.SDK_INT >= 29) {
          bitmap = resolver.loadThumbnail(uri, new Size(240, 240), null);
        } else {
          bitmap = MediaStore.Video.Thumbnails.getThumbnail(
            resolver, id, MediaStore.Video.Thumbnails.MINI_KIND, null);
        }
        if (bitmap == null) return "";
        try (FileOutputStream out = new FileOutputStream(thumbnail)) {
          bitmap.compress(Bitmap.CompressFormat.JPEG, 72, out);
        }
        return Uri.fromFile(thumbnail).toString();
      } catch (Exception ignored) {
        return "";
      } finally {
        if (bitmap != null) bitmap.recycle();
      }
    }

    @ReactMethod public void listAlbums(Promise promise) {
      worker.execute(() -> {
        try {
          ContentResolver resolver = context.getContentResolver();
          String typeColumn = MediaStore.Files.FileColumns.MEDIA_TYPE;
          String selection = typeColumn + " IN (?, ?)";
          String[] args = {
            String.valueOf(MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE),
            String.valueOf(MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO)
          };
          String bucketIdColumn = "bucket_id";
          String bucketNameColumn = "bucket_display_name";
          java.util.LinkedHashMap<String, WritableMap> albums = new java.util.LinkedHashMap<>();
          String[] projection = {
            bucketIdColumn, bucketNameColumn, MediaStore.MediaColumns._ID, typeColumn
          };
          try (Cursor cursor = resolver.query(MediaStore.Files.getContentUri("external"),
              projection, selection, args, MediaStore.MediaColumns.DATE_ADDED + " DESC")) {
            if (cursor != null) {
              // Album lookup is bounded to prevent a giant, blocking catalog on older devices.
              int visited = 0;
              while (cursor.moveToNext() && visited++ < 10000) {
                String id = cursor.getString(0);
                if (id == null || id.isEmpty()) continue;
                WritableMap entry = albums.get(id);
                if (entry == null) {
                  entry = Arguments.createMap();
                  entry.putString("id", id);
                  String title = cursor.getString(1);
                  entry.putString("name", title == null ? "Autres" : title);
                  boolean video = cursor.getInt(3) == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO;
                  long assetId = cursor.getLong(2);
                  entry.putString("thumbnail", thumbnail(resolver,
                    ContentUris.withAppendedId(video ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                      : MediaStore.Images.Media.EXTERNAL_CONTENT_URI, assetId), assetId, video));
                  entry.putInt("count", 0);
                  albums.put(id, entry);
                }
                entry.putInt("count", entry.getInt("count") + 1);
              }
            }
          }
          WritableArray array = Arguments.createArray();
          for (WritableMap entry : albums.values()) array.pushMap(entry);
          promise.resolve(array);
        } catch (SecurityException denied) {
          promise.reject("GALLERY_PERMISSION", "Autorisation galerie nécessaire.", denied);
        } catch (Exception failure) {
          promise.reject("ALBUMS_UNAVAILABLE", "Albums indisponibles.", failure);
        }
      });
    }

    @ReactMethod public void pickDocuments(boolean multiple, Promise promise) {
      Activity activity = getCurrentActivity();
      if (activity == null) { promise.reject("ACTIVITY_MISSING", "Aucune fenêtre Android disponible."); return; }
      if (pickerPromise != null) { promise.reject("PICKER_BUSY", "Sélection déjà en cours."); return; }
      pickerPromise = promise;
      try {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.setType("*/*");
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        activity.startActivityForResult(intent, PICK_FILES);
      } catch (Exception failure) {
        pickerPromise = null;
        promise.reject("FILES_UNAVAILABLE", "Le sélecteur de fichiers est indisponible.", failure);
      }
    }

    private WritableMap fileDetail(Uri uri) {
      ContentResolver resolver = context.getContentResolver();
      String name = "document";
      long size = -1;
      try (Cursor c = resolver.query(uri,
        new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE }, null, null, null)) {
        if (c != null && c.moveToFirst()) {
          String display = c.getString(0);
          if (display != null && !display.isEmpty()) name = display;
          if (!c.isNull(1)) size = c.getLong(1);
        }
      }
      try { resolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION); }
      catch (SecurityException ignored) { /* Grant remains valid for the immediate transfer. */ }
      WritableMap map = Arguments.createMap();
      map.putString("uri", uri.toString());
      map.putString("name", name);
      String mime = resolver.getType(uri);
      map.putString("mime", mime == null ? "application/octet-stream" : mime.toLowerCase(Locale.ROOT));
      map.putDouble("size", (double) size);
      return map;
    }
  }
}
