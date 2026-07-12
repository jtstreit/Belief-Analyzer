/**
 * Capture Setup screen — Android ambient capture onboarding.
 *
 * Platform-guarded: shows capability explanations + permission request buttons
 * on Android + custom dev build. On web / Expo Go / iOS it shows "Requires
 * Android dev build" status for each capture method without crashing.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

// Lazy import — always use the bridge module's public API, never call
// the native module directly.
import {
  isNativeCaptureAvailable,
  requestNotificationListenerPermission,
  requestUsageStatsPermission,
  getNativeCaptureStatus,
  type NativeCaptureStatus,
} from '@/modules/native-capture';

// ─── Permission row component ────────────────────────────────────────────────

type StatusKind = 'granted' | 'pending' | 'unavailable';

function PermissionRow({
  icon,
  title,
  description,
  statusKind,
  onRequest,
  index,
}: {
  icon: string;
  title: string;
  description: string;
  statusKind: StatusKind;
  onRequest?: () => Promise<void>;
  index: number;
}) {
  const colors = useColors();
  const [loading, setLoading] = useState(false);

  const handlePress = useCallback(async () => {
    if (!onRequest) return;
    setLoading(true);
    try {
      await onRequest();
    } finally {
      setLoading(false);
    }
  }, [onRequest]);

  const statusColor =
    statusKind === 'granted'
      ? '#10B981'
      : statusKind === 'pending'
        ? colors.primary
        : colors.mutedForeground;

  const statusLabel =
    statusKind === 'granted'
      ? 'Granted'
      : statusKind === 'pending'
        ? 'Not granted'
        : 'Requires dev build';

  const statusIcon =
    statusKind === 'granted'
      ? 'check-circle'
      : statusKind === 'pending'
        ? 'alert-circle'
        : 'info';

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).duration(500).springify()}
      style={[styles.row, { borderColor: colors.border }]}
    >
      <LinearGradient
        colors={['#1E2540', '#141928']}
        style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
      />
      <View style={styles.rowHeader}>
        <View style={[styles.rowIcon, { backgroundColor: `${colors.accent}22` }]}>
          <Feather name={icon as any} size={18} color={colors.accent} />
        </View>
        <Text style={[styles.rowTitle, { color: colors.cardForeground }]}>{title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}22` }]}>
          <Feather name={statusIcon as any} size={11} color={statusColor} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>
      <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>{description}</Text>
      {statusKind === 'pending' && onRequest && (
        <TouchableOpacity
          style={[styles.requestBtn, { backgroundColor: colors.primary }]}
          onPress={handlePress}
          disabled={loading}
        >
          <Text style={[styles.requestBtnText, { color: colors.primaryForeground }]}>
            {loading ? 'Opening settings…' : 'Request permission'}
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function PermissionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const nativeAvailable = isNativeCaptureAvailable();

  const [status, setStatus] = useState<NativeCaptureStatus>({
    notificationListenerEnabled: false,
    usageStatsEnabled: false,
    shareTargetEnabled: false,
  });

  useEffect(() => {
    getNativeCaptureStatus().then(setStatus).catch(() => {});
  }, []);

  const refreshStatus = useCallback(async () => {
    const s = await getNativeCaptureStatus();
    setStatus(s);
  }, []);

  const handleNotification = useCallback(async () => {
    await requestNotificationListenerPermission();
    await refreshStatus();
  }, [refreshStatus]);

  const handleUsageStats = useCallback(async () => {
    await requestUsageStatsPermission();
    await refreshStatus();
  }, [refreshStatus]);

  function notifStatus(): StatusKind {
    if (!nativeAvailable) return 'unavailable';
    return status.notificationListenerEnabled ? 'granted' : 'pending';
  }

  function usageStatus(): StatusKind {
    if (!nativeAvailable) return 'unavailable';
    return status.usageStatsEnabled ? 'granted' : 'pending';
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.intro}>
          <View style={[styles.introIcon, { backgroundColor: `${colors.primary}22` }]}>
            <Feather name="radio" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.introTitle, { color: colors.foreground }]}>
            Ambient Capture
          </Text>
          <Text style={[styles.introBody, { color: colors.mutedForeground }]}>
            The REBT Companion can passively capture thought-related data from
            your Android device — notifications, app usage, and shared text —
            to build a richer cognitive conceptualization without manual entry.
          </Text>
          {!nativeAvailable && Platform.OS !== 'android' && (
            <View
              style={[styles.platformNote, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}44` }]}
            >
              <Feather name="info" size={14} color={colors.primary} />
              <Text style={[styles.platformNoteText, { color: colors.primary }]}>
                Ambient capture requires an Android device with the custom dev
                build installed. See the native integration spec for setup.
              </Text>
            </View>
          )}
          {!nativeAvailable && Platform.OS === 'android' && (
            <View
              style={[styles.platformNote, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}44` }]}
            >
              <Feather name="info" size={14} color={colors.primary} />
              <Text style={[styles.platformNoteText, { color: colors.primary }]}>
                Running in Expo Go — native modules unavailable. Build the custom
                dev build to enable capture. See docs/native-integration-spec.md.
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Permission rows */}
        <View style={styles.rows}>
          <PermissionRow
            index={0}
            icon="bell"
            title="Notification Listener"
            description="Reads notification content from other apps to extract thought-related text. Only processes text snippets — not images, media, or notification actions."
            statusKind={notifStatus()}
            onRequest={nativeAvailable ? handleNotification : undefined}
          />
          <PermissionRow
            index={1}
            icon="bar-chart-2"
            title="Usage Statistics"
            description="Records which apps are in the foreground as situational context for your thought log. Stores app package names and timestamps only — no content."
            statusKind={usageStatus()}
            onRequest={nativeAvailable ? handleUsageStats : undefined}
          />
          <PermissionRow
            index={2}
            icon="share-2"
            title="Share Target"
            description="Lets you share text from any app into REBT Companion as a thought entry. No special permission needed — it is enabled via the app manifest."
            statusKind="unavailable"
          />
        </View>

        {/* Disclaimer */}
        <Animated.View
          entering={FadeInDown.delay(320).duration(500)}
          style={[styles.disclaimer, { backgroundColor: colors.muted, borderColor: colors.border }]}
        >
          <Feather name="shield" size={16} color={colors.mutedForeground} />
          <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
            Captured text is stored locally and sent to the local API server.
            When you tap "Analyse", excerpts of your thought text are sent to
            Claude (Anthropic) — an external AI service — for cognitive pattern
            extraction. Do not capture text you would not share with an AI provider.
            This app is a personal self-help tool, not a medical device or
            clinical service.
          </Text>
        </Animated.View>

        {/* Dev build reference */}
        <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.devNote}>
          <Text style={[styles.devNoteLabel, { color: colors.mutedForeground }]}>
            Implementation guide
          </Text>
          <Text style={[styles.devNotePath, { color: colors.accent }]}>
            docs/native-integration-spec.md
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 20 },

  intro: { gap: 12, alignItems: 'center' },
  introIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  introBody: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    textAlign: 'center',
  },
  platformNote: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  platformNoteText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20, flex: 1 },

  rows: { gap: 12 },
  row: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
    gap: 10,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', flex: 1 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  rowDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  requestBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  requestBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  disclaimer: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  disclaimerText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20, flex: 1 },

  devNote: { gap: 4, alignItems: 'center' },
  devNoteLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  devNotePath: { fontSize: 13, fontFamily: 'Inter_500Medium' },
});
