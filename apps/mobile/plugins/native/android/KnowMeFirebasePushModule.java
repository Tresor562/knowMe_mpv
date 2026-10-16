package com.knowme.app.updates;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.google.firebase.messaging.FirebaseMessaging;

/** Only compiled into APKs provisioned with a real matching Firebase project. */
public final class KnowMeFirebasePushModule extends ReactContextBaseJavaModule {
  public KnowMeFirebasePushModule(ReactApplicationContext context) { super(context); }

  @Override
  public String getName() { return "KnowMeFirebasePush"; }

  @ReactMethod
  public void subscribeToUpdates(Promise promise) {
    try {
      FirebaseMessaging.getInstance()
        .subscribeToTopic("knowme_android_preview_updates")
        .addOnCompleteListener(task -> {
          if (task.isSuccessful()) {
            promise.resolve(true);
          } else {
            promise.reject("FIREBASE_SUBSCRIBE_FAILED",
              "Impossible d'activer les notifications de mise à jour.", task.getException());
          }
        });
    } catch (Exception error) {
      promise.reject("FIREBASE_NOT_CONFIGURED", "Firebase non configuré.", error);
    }
  }
}
