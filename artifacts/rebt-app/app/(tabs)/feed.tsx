import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListTelemetry } from '@workspace/api-client-react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

// ─── Config maps ────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  thought_entry: { label: 'Thought', color: '#6366F1', icon: 'edit-3' },
  mood_checkin: { label: 'Mood', color: '#F59E0B', icon: 'heart' },
  shared_text: { label: 'Shared', color: '#10B981', icon: 'share-2' },
  notification: { label: 'Notification', color: '#8B5CF6', icon: 'bell' },
  app_usage: { label: 'App Usage', color: '#EC4899', icon: 'smartphone' },
  browser: { label: 'Browser', color: '#3B82F6', icon: 'globe' },
};

function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Event card ─────────────────────────────────────────────────────────────

function EventCard({
  event,
  index,
}: {
  event: {
    id: number;
    type: string;
    mood?: string | null;
    thoughtText?: string | null;
    source?: string | null;
    processedAt?: string | null;
    createdAt: string;
  };
  index: number;
}) {
  const colors = useColors();
  const cfg = TYPE_CONFIG[event.type] ?? { label: event.type, color: '#6B7194', icon: 'activity' };
  const isProcessed = event.processedAt != null;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40).duration(400).springify()}
      style={[styles.card, { borderColor: colors.border, opacity: isProcessed ? 0.85 : 1 }]}
    >
      <LinearGradient
        colors={['#1E2540', '#141928']}
        style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
      />
      <View style={styles.cardTop}>
        {/* Type badge */}
        <View style={[styles.typeBadge, { backgroundColor: `${cfg.color}22` }]}>
          <Feather name={cfg.icon as any} size={11} color={cfg.color} />
          <Text style={[styles.typeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        {/* Source badge */}
        {event.source && event.source !== 'manual' && (
          <View style={[styles.sourceBadge, { backgroundColor: colors.secondary }]}>
            <Text
              style={[styles.sourceText, { color: colors.secondaryForeground }]}
              numberOfLines={1}
            >
              {event.source}
            </Text>
          </View>
        )}
        {/* Time */}
        <Text style={[styles.time, { color: colors.mutedForeground }]}>
          {formatTime(event.createdAt)}
        </Text>
      </View>

      {/* Content */}
      {event.thoughtText ? (
        <Text style={[styles.content, { color: colors.cardForeground }]} numberOfLines={3}>
          {event.thoughtText}
        </Text>
      ) : event.mood ? (
        <Text style={[styles.mood, { color: colors.primary }]}>Mood: {event.mood}</Text>
      ) : null}

      {/* Processed status */}
      <View style={styles.statusRow}>
        {isProcessed ? (
          <>
            <Feather name="check-circle" size={12} color="#10B981" />
            <Text style={[styles.statusText, { color: '#10B981' }]}>Processed</Text>
          </>
        ) : (
          <>
            <Feather name="clock" size={12} color={colors.mutedForeground} />
            <Text style={[styles.statusText, { color: colors.mutedForeground }]}>Pending analysis</Text>
          </>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: events, isLoading, refetch } = useListTelemetry({ limit: 80 });

  const pendingCount = events?.filter((e) => !e.processedAt).length ?? 0;
  const totalCount = events?.length ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Telemetry Feed</Text>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryPill, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.summaryText, { color: colors.secondaryForeground }]}>
              {totalCount} events
            </Text>
          </View>
          {pendingCount > 0 && (
            <View style={[styles.summaryPill, { backgroundColor: `${colors.primary}22` }]}>
              <Feather name="clock" size={11} color={colors.primary} />
              <Text style={[styles.summaryText, { color: colors.primary }]}>
                {pendingCount} pending
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {!isLoading && totalCount === 0 ? (
          <View style={styles.empty}>
            <Feather name="activity" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No events yet</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              Complete a mood check-in or thought entry. With a custom dev build, notifications
              and app-usage events will appear here automatically.
            </Text>
          </View>
        ) : (
          (events ?? []).map((event, i) => (
            <EventCard key={event.id} event={event} index={i} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 8,
  },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  summaryText: { fontSize: 12, fontFamily: 'Inter_500Medium' },

  scroll: { paddingHorizontal: 20, gap: 10, paddingTop: 4 },

  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    overflow: 'hidden',
    gap: 8,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: 120,
  },
  sourceText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  time: { fontSize: 12, fontFamily: 'Inter_400Regular', marginLeft: 'auto' },
  content: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  mood: { fontSize: 14, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusText: { fontSize: 12, fontFamily: 'Inter_400Regular' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 16 },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  emptyBody: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
});
