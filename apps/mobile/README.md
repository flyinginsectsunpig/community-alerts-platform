# Community Alerts for Android

A native Android shell, built with [Capacitor](https://capacitorjs.com), around
the deployed web dashboard. The app loads the live site (`server.url` in
`capacitor.config.ts`), so web deploys reach it without a new app release.
Only `www/offline.html`, the screen shown with no connection, ships inside it.

## Build a debug APK

Needs JDK 21 and the Android SDK (platform 36), with `JAVA_HOME` and
`ANDROID_HOME` set.

```bash
npm ci
npm run sync
cd android && ./gradlew assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`. After
changing `capacitor.config.ts` or `www/`, run `npm run sync` again.

## Limits

Android's WebView has no Web Push, so the site's "Notify this device" option
can't work in the app. Push needs Firebase Cloud Messaging on the backend.
