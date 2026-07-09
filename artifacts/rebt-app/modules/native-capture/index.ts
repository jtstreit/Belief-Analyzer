/**
 * Native Capture Bridge — platform-guarded shell for Android native modules.
 *
 * This module is the ONLY place where native Android functionality is imported.
 * All imports are lazy and wrapped in try/catch so that:
 *   - The web preview and Expo Go keep bundling and running.
 *   - Missing native support surfaces as a clear "requires dev build" state.
 *   - Claude Code can implement `NativeCaptureModule` against this exact interface.
 *
 * ─── INTERFACE CONTRACT ────────────────────────────────────────────────────
 * When Claude Code implements the native side, `./NativeCaptureModule` must
 * default-export an object satisfying `NativeCaptureModuleInterface` below.
 * See /docs/native-integration-spec.md for the full implementation guide.
 * ───────────────────────────────────────────────────────────────────────────
 */

import { Platform } from 'react-native';

// ─── Public types ────────────────────────────────────────────────────────────

export interface NativeCaptureStatus {
  /** Whether NotificationListenerService is bound and active. */
  notificationListenerEnabled: boolean;
  /** Whether PACKAGE_USAGE_STATS permission has been granted. */
  usageStatsEnabled: boolean;
  /** Whether the app is registered as a Share Target. */
  shareTargetEnabled: boolean;
}

/** Shape the native module must implement. */
interface NativeCaptureModuleInterface {
  requestNotificationListenerPermission: () => Promise<boolean>;
  requestUsageStatsPermission: () => Promise<boolean>;
  getCaptureStatus: () => Promise<NativeCaptureStatus>;
  startCapture: () => Promise<void>;
  stopCapture: () => Promise<void>;
}

// ─── Internal lazy loader ────────────────────────────────────────────────────

/**
 * Dynamically load the native module at call time, not import time.
 * Returns null when the module is absent (Expo Go, web, iOS, bare Android
 * without the custom dev build).
 */
function getNativeModule(): NativeCaptureModuleInterface | null {
  if (Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./NativeCaptureModule');
    return (mod?.default ?? mod) as NativeCaptureModuleInterface;
  } catch {
    // Expected on Expo Go and web — module not compiled yet.
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns true only when running in a custom Android dev build that has
 * compiled the NativeCaptureModule native module.
 */
export function isNativeCaptureAvailable(): boolean {
  return getNativeModule() !== null;
}

/**
 * Opens the Android "Notification Access" system settings page so the user
 * can grant the NotificationListenerService permission.
 * Returns false when the native module is unavailable.
 */
export async function requestNotificationListenerPermission(): Promise<boolean> {
  const mod = getNativeModule();
  if (!mod) return false;
  return mod.requestNotificationListenerPermission();
}

/**
 * Opens the Android "Usage Access" system settings page so the user can
 * grant PACKAGE_USAGE_STATS permission.
 * Returns false when the native module is unavailable.
 */
export async function requestUsageStatsPermission(): Promise<boolean> {
  const mod = getNativeModule();
  if (!mod) return false;
  return mod.requestUsageStatsPermission();
}

/**
 * Returns the current grant status of all three capture permissions.
 * Always returns all-false when the native module is unavailable.
 */
export async function getNativeCaptureStatus(): Promise<NativeCaptureStatus> {
  const mod = getNativeModule();
  if (!mod) {
    return {
      notificationListenerEnabled: false,
      usageStatsEnabled: false,
      shareTargetEnabled: false,
    };
  }
  return mod.getCaptureStatus();
}

/**
 * Start active background capture (notification listener + usage stats
 * polling). No-op when the native module is unavailable.
 */
export async function startNativeCapture(): Promise<void> {
  const mod = getNativeModule();
  if (!mod) return;
  return mod.startCapture();
}

/**
 * Stop active background capture.
 * No-op when the native module is unavailable.
 */
export async function stopNativeCapture(): Promise<void> {
  const mod = getNativeModule();
  if (!mod) return;
  return mod.stopCapture();
}
