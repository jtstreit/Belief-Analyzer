# Native Integration Spec — REBT Companion Ambient Capture

**For:** Claude Code / custom Android dev build  
**Status:** Stable contract — bridge shell is in `artifacts/rebt-app/modules/native-capture/index.ts`

---

## Overview

The REBT Companion captures ambient data from three Android sources to build
a richer cognitive conceptualization without manual entry:

| Source | Mechanism | Data |
|---|---|---|
| Notification Listener | `NotificationListenerService` | Notification title + text snippets |
| Usage Stats | `UsageStatsManager` polling | App package name + foreground durations |
| Share Target | Android intent filter | Text shared from any app |

All captured data is posted to the local Express API (`POST /api/telemetry` or
`POST /api/telemetry/batch`). The cognitive engine picks it up on next analysis.

---

## Architecture

```
Android device
├── NotificationListenerService   ──POST /api/telemetry/batch──▶ API server
├── UsageStats background job     ──POST /api/telemetry/batch──▶ API server
├── Share Target Activity         ──POST /api/telemetry ───────▶ API server
└── NativeCaptureModule (RN)      ◀── JS bridge (permissions / status)
                                       artifacts/rebt-app/modules/native-capture/
```

---

## Required npm packages

```bash
# Add to artifacts/rebt-app/package.json
@notifee/react-native          # notification access + display helpers
expo-modules-core              # already present — for the native module
```

For the native module itself, you can either:
- Write a bare Expo module using `expo-modules-core` (recommended)
- Use a bare React Native turbo module

---

## Android permissions (app.json / app.config.ts)

```json
{
  "expo": {
    "android": {
      "permissions": [
        "android.permission.PACKAGE_USAGE_STATS",
        "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
      ],
      "intentFilters": [
        {
          "action": "android.intent.action.SEND",
          "category": ["android.intent.category.DEFAULT"],
          "data": { "mimeType": "text/plain" }
        }
      ]
    },
    "plugins": [
      ["./modules/native-capture/plugin", {}]
    ]
  }
}
```

> **Note:** `PACKAGE_USAGE_STATS` and `BIND_NOTIFICATION_LISTENER_SERVICE` are
> *special* permissions that cannot be granted by `requestPermissionsAsync`.
> They require sending the user to a system settings page:
> - Notification: `Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS`
> - Usage Stats: `Settings.ACTION_USAGE_ACCESS_SETTINGS`
>
> The JS bridge methods `requestNotificationListenerPermission()` and
> `requestUsageStatsPermission()` should call `startActivity(intent)` to open
> the relevant settings page, then return true.

---

## JS bridge interface contract

The file `artifacts/rebt-app/modules/native-capture/index.ts` lazy-loads
`./NativeCaptureModule`. You must provide that file as the **default export**
satisfying this interface:

```typescript
interface NativeCaptureModuleInterface {
  /**
   * Open the Android Notification Access settings page.
   * Returns true once the intent has fired (not when permission is granted).
   */
  requestNotificationListenerPermission(): Promise<boolean>;

  /**
   * Open the Android Usage Access settings page.
   * Returns true once the intent has fired.
   */
  requestUsageStatsPermission(): Promise<boolean>;

  /**
   * Return the current grant status of all three capture permissions.
   */
  getCaptureStatus(): Promise<{
    notificationListenerEnabled: boolean;
    usageStatsEnabled: boolean;
    shareTargetEnabled: boolean; // always true if intent filter is in manifest
  }>;

  /** Start the background capture service. */
  startCapture(): Promise<void>;

  /** Stop the background capture service. */
  stopCapture(): Promise<void>;
}
```

Create the file at:
```
artifacts/rebt-app/modules/native-capture/NativeCaptureModule.ts
```

and export the native module instance as default:
```typescript
import { requireNativeModule } from 'expo-modules-core';
export default requireNativeModule('NativeCaptureModule');
```

---

## API endpoints the native code calls

All requests go to `http://localhost:<PORT>/api` where PORT is the Express
server's port (default 3001). In a dev build on the same device, localhost is
the device's loopback. In production, use the Replit deploy URL.

### Single event
```
POST /api/telemetry
Content-Type: application/json

{
  "type": "notification" | "app_usage" | "shared_text",
  "thoughtText": "string — the captured text content",
  "source": "com.example.app | manual | share_sheet",
  "mood": null
}
```

### Batch (preferred for notification bursts)
```
POST /api/telemetry/batch
Content-Type: application/json

{
  "events": [
    {
      "type": "notification",
      "thoughtText": "Meeting cancelled tomorrow",
      "source": "com.google.android.calendar"
    },
    {
      "type": "app_usage",
      "thoughtText": "Foreground: com.twitter.android (8m)",
      "source": "com.twitter.android"
    }
  ]
}
```

**Response:** `201 Created` with array of created TelemetryEvent objects.

---

## NotificationListenerService implementation

```kotlin
// android/app/src/main/java/com/yourapp/NativeCaptureLService.kt

class NativeCaptureListenerService : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val extras = sbn.notification.extras
        val title = extras.getString(Notification.EXTRA_TITLE) ?: return
        val text  = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: return

        // Filter: only text-bearing notifications longer than 10 chars
        val combined = "$title — $text"
        if (combined.length < 10) return

        // Post async — do not block the listener callback
        CoroutineScope(Dispatchers.IO).launch {
            postBatch(listOf(mapOf(
                "type"        to "notification",
                "thoughtText" to combined.take(500),  // cap length
                "source"      to sbn.packageName
            )))
        }
    }

    private suspend fun postBatch(events: List<Map<String, String>>) {
        // Replace port with actual Express server port
        val url = "http://localhost:3001/api/telemetry/batch"
        val body = JSONObject(mapOf("events" to events)).toString()
        // ... http POST using OkHttp or HttpURLConnection
    }
}
```

Register in `AndroidManifest.xml`:
```xml
<service
    android:name=".NativeCaptureListenerService"
    android:label="REBT Capture"
    android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
    android:exported="true">
  <intent-filter>
    <action android:name="android.service.notification.NotificationListenerService" />
  </intent-filter>
</service>
```

---

## UsageStats polling implementation

Poll every 15 minutes using a WorkManager job:

```kotlin
class UsageStatsWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result {
        val usm = applicationContext.getSystemService(Context.USAGE_STATS_SERVICE)
                as UsageStatsManager
        val end = System.currentTimeMillis()
        val start = end - 15 * 60 * 1000L  // last 15 minutes

        val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_BEST, start, end)
        val events = stats
            .filter { it.totalTimeInForeground > 5000 }  // >5s
            .map { mapOf(
                "type"        to "app_usage",
                "thoughtText" to "Foreground: ${it.packageName} (${it.totalTimeInForeground / 1000}s)",
                "source"      to it.packageName
            ) }

        if (events.isNotEmpty()) postBatch(events)
        return Result.success()
    }
}
```

---

## Share Target Activity

```kotlin
class ShareTargetActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (intent?.action == Intent.ACTION_SEND && intent.type == "text/plain") {
            val text = intent.getStringExtra(Intent.EXTRA_TEXT)
            if (!text.isNullOrBlank()) {
                CoroutineScope(Dispatchers.IO).launch {
                    postSingle(mapOf(
                        "type"        to "shared_text",
                        "thoughtText" to text.take(1000),
                        "source"      to "share_sheet"
                    ))
                }
            }
        }
        // Return to previous app
        finish()
    }
}
```

---

## NativeCaptureModule (Expo Module)

```kotlin
// android/src/main/java/expo/modules/nativecapture/NativeCaptureModule.kt

class NativeCaptureModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("NativeCaptureModule")

        AsyncFunction("requestNotificationListenerPermission") {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            appContext.activityProvider?.currentActivity?.startActivity(intent)
            true
        }

        AsyncFunction("requestUsageStatsPermission") {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            appContext.activityProvider?.currentActivity?.startActivity(intent)
            true
        }

        AsyncFunction("getCaptureStatus") {
            val nm = appContext.reactContext?.getSystemService(Context.NOTIFICATION_SERVICE)
                    as NotificationManager
            val notifEnabled = NotificationManagerCompat
                .getEnabledListenerPackages(appContext.reactContext!!)
                .contains(appContext.reactContext!!.packageName)

            val usm = appContext.reactContext?.getSystemService(Context.APP_OPS_SERVICE)
                    as AppOpsManager
            val mode = usm.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                appContext.reactContext!!.packageName
            )
            val usageEnabled = mode == AppOpsManager.MODE_ALLOWED

            mapOf(
                "notificationListenerEnabled" to notifEnabled,
                "usageStatsEnabled"           to usageEnabled,
                "shareTargetEnabled"          to true
            )
        }

        AsyncFunction("startCapture") {
            // Schedule UsageStatsWorker with WorkManager
            val request = PeriodicWorkRequestBuilder<UsageStatsWorker>(15, TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(appContext.reactContext!!)
                .enqueueUniquePeriodicWork("usageStats", ExistingPeriodicWorkPolicy.KEEP, request)
        }

        AsyncFunction("stopCapture") {
            WorkManager.getInstance(appContext.reactContext!!)
                .cancelUniqueWork("usageStats")
        }
    }
}
```

---

## Checklist before building

- [ ] `NativeCaptureModule.ts` JS shim created at `modules/native-capture/NativeCaptureModule.ts`
- [ ] Kotlin module registered in `android/app/src/main/AndroidManifest.xml`
- [ ] `NotificationListenerService` registered in manifest
- [ ] Share Target intent filter in manifest
- [ ] `WorkManager` dependency in `android/app/build.gradle`
- [ ] `OkHttp` or equivalent for HTTP calls from background services
- [ ] Run `eas build --profile development --platform android` to produce the dev build APK
- [ ] Sideload APK, open app, navigate to **Capture Setup** tab, grant both permissions
- [ ] Send a test notification, verify it appears in the **Feed** tab within 30 seconds
- [ ] Trigger Analyse on the **Mind Map** tab and confirm automatic thoughts populate

---

## Data privacy notes

- Notification text is capped at 500 characters per event.
- No images, attachments, or notification actions are captured.
- Captured events are stored locally in the Postgres database on the same machine.
- **External AI disclosure:** When the user taps "Analyse" on the Mind Map screen,
  excerpts of captured thought text are sent to DeepSeek (api.deepseek.com) for
  cognitive pattern extraction. This is an external service outside the device.
  The app should not be used to capture sensitive personal information (passwords,
  financial data, medical records) that must not leave the device.
- Beyond the DeepSeek API call during analysis, the app makes no other outbound
  network requests.
