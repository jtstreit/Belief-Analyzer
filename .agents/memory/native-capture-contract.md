---
name: Native capture bridge contract
description: Rules for the JS-side native module bridge at modules/native-capture/.
---

## Rule
All native imports in `artifacts/rebt-app/modules/native-capture/index.ts` must be
lazy (`require()` inside try/catch) AND Platform.OS-guarded. Never import the native
module at the top level.

**Why:** The app runs in Expo Go and on web where native modules are absent.
Top-level native imports crash Metro bundling or throw at module load.

## How to apply
```typescript
// Safe pattern (already in index.ts):
function getNativeModule() {
  if (Platform.OS !== 'android') return null;
  try {
    return require('./NativeCaptureModule').default;
  } catch {
    return null;
  }
}
```

## Contract for Claude Code
Claude Code must implement `NativeCaptureModule.ts` at:
  `artifacts/rebt-app/modules/native-capture/NativeCaptureModule.ts`

as a default export satisfying:
  `requestNotificationListenerPermission(): Promise<boolean>`
  `requestUsageStatsPermission(): Promise<boolean>`
  `getCaptureStatus(): Promise<NativeCaptureStatus>`
  `startCapture(): Promise<void>`
  `stopCapture(): Promise<void>`

Full handoff document: `docs/native-integration-spec.md`
