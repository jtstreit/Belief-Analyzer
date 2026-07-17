import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGetCognitiveMapQueryKey,
  getGetSentinelStatusQueryKey,
  getListTelemetryQueryKey,
  useAnalyzeCognitive,
  useGetSentinelStatus,
  useListTelemetry,
  useSyncSentinel,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

// ─── Config maps ────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: string }
> = {
  thought_entry: {
    label: "Thought",
    color: "#357A93",
    bg: "#E8F3F7",
    icon: "edit-3",
  },
  mood_checkin: {
    label: "Mood",
    color: "#C4601A",
    bg: "#FDF0E6",
    icon: "heart",
  },
  shared_text: {
    label: "Shared",
    color: "#2E8A6A",
    bg: "#E6F5F0",
    icon: "share-2",
  },
  notification: {
    label: "Notification",
    color: "#6B5BA6",
    bg: "#F0EEFA",
    icon: "bell",
  },
  app_usage: {
    label: "App Usage",
    color: "#A0456A",
    bg: "#F7E8EF",
    icon: "smartphone",
  },
  browser: { label: "Browser", color: "#357A93", bg: "#E8F3F7", icon: "globe" },
};

function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
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
  const cfg = TYPE_CONFIG[event.type] ?? {
    label: event.type,
    color: "#7B7266",
    bg: "#ECEEE9",
    icon: "activity",
  };
  const isProcessed = event.processedAt != null;
  const displaySource = event.source?.replace(/^lifeops::/, "") ?? null;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40)
        .duration(400)
        .springify()}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: isProcessed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.cardTop}>
        {/* Type badge */}
        <View style={[styles.typeBadge, { backgroundColor: cfg.bg }]}>
          <Feather name={cfg.icon as any} size={11} color={cfg.color} />
          <Text style={[styles.typeText, { color: cfg.color }]}>
            {cfg.label}
          </Text>
        </View>
        {/* Source badge */}
        {displaySource && displaySource !== "manual" && (
          <View
            style={[styles.sourceBadge, { backgroundColor: colors.secondary }]}
          >
            <Text
              style={[styles.sourceText, { color: colors.secondaryForeground }]}
              numberOfLines={1}
            >
              {displaySource}
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
        <Text
          style={[styles.content, { color: colors.cardForeground }]}
          numberOfLines={3}
        >
          {event.thoughtText}
        </Text>
      ) : event.mood ? (
        <Text style={[styles.mood, { color: colors.primary }]}>
          Mood: {event.mood}
        </Text>
      ) : null}

      {/* Processed status */}
      <View style={styles.statusRow}>
        {isProcessed ? (
          <>
            <Feather
              name="check-circle"
              size={12}
              color={(colors as any).success}
            />
            <Text
              style={[styles.statusText, { color: (colors as any).success }]}
            >
              Processed
            </Text>
          </>
        ) : (
          <>
            <Feather name="clock" size={12} color={colors.mutedForeground} />
            <Text
              style={[styles.statusText, { color: colors.mutedForeground }]}
            >
              Pending analysis
            </Text>
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
  const queryClient = useQueryClient();
  const [pipelineMessage, setPipelineMessage] = useState<string | null>(null);

  const { data: events, isLoading, refetch } = useListTelemetry({ limit: 100 });
  const { data: sentinelStatus } = useGetSentinelStatus();
  const syncSentinel = useSyncSentinel();
  const analyzeCognitive = useAnalyzeCognitive();

  const pendingCount = events?.filter((e) => !e.processedAt).length ?? 0;
  const totalCount = events?.length ?? 0;
  const isScanning = syncSentinel.isPending || analyzeCognitive.isPending;

  const handleScan = useCallback(async () => {
    if (isScanning) return;
    setPipelineMessage("Pulling protected LifeOps signals…");
    try {
      const sync = await syncSentinel.mutateAsync();
      const shouldAnalyze = sync.ingested > 0 || pendingCount > 0;
      let thoughtCount: number | null = null;
      if (shouldAnalyze) {
        setPipelineMessage("Opus 4.8 is identifying distortions and beliefs…");
        const map = await analyzeCognitive.mutateAsync();
        thoughtCount = map.automaticThoughts.length;
      }
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: getListTelemetryQueryKey() }),
        queryClient.invalidateQueries({
          queryKey: getGetCognitiveMapQueryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetSentinelStatusQueryKey(),
        }),
      ]);
      const protectedCount = sync.filteredClinical + sync.filteredLocation;
      setPipelineMessage(
        sync.ingested > 0
          ? `${sync.ingested} new signal${sync.ingested === 1 ? "" : "s"} analysed${thoughtCount == null ? "" : ` · ${thoughtCount} suspected thoughts total`}${protectedCount > 0 ? ` · ${protectedCount} protected` : ""}`
          : `Signals are current${protectedCount > 0 ? ` · ${protectedCount} protected` : ""}`,
      );
    } catch {
      setPipelineMessage(
        "Scan failed. Your existing insights are unchanged; tap to retry.",
      );
    }
  }, [
    analyzeCognitive,
    isScanning,
    pendingCount,
    queryClient,
    refetch,
    syncSentinel,
  ]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Phone Signals
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          LifeOps → Opus 4.8 → suspected patterns
        </Text>
        <View style={styles.summaryRow}>
          <View
            style={[styles.summaryPill, { backgroundColor: colors.secondary }]}
          >
            <Text
              style={[
                styles.summaryText,
                { color: colors.secondaryForeground },
              ]}
            >
              {totalCount} events
            </Text>
          </View>
          {pendingCount > 0 && (
            <View
              style={[
                styles.summaryPill,
                { backgroundColor: `${colors.primary}22` },
              ]}
            >
              <Feather name="clock" size={11} color={colors.primary} />
              <Text style={[styles.summaryText, { color: colors.primary }]}>
                {pendingCount} pending
              </Text>
            </View>
          )}
        </View>
        <View
          style={[
            styles.pipelineCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.pipelineCopy}>
            <View style={styles.pipelineTitleRow}>
              <View
                style={[
                  styles.liveDot,
                  {
                    backgroundColor: sentinelStatus?.configured
                      ? "#38B77A"
                      : "#D99035",
                  },
                ]}
              />
              <Text
                style={[styles.pipelineTitle, { color: colors.cardForeground }]}
              >
                LifeOps telemetry
              </Text>
              <Text style={[styles.modelBadge, { color: colors.primary }]}>
                OPUS 4.8
              </Text>
            </View>
            <Text
              style={[styles.pipelineStatus, { color: colors.mutedForeground }]}
            >
              {pipelineMessage ??
                (sentinelStatus?.configured
                  ? "Clinical and location content is filtered before analysis."
                  : "Server connection needs its LifeOps ingest credential.")}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.scanButton,
              {
                backgroundColor: isScanning ? colors.secondary : colors.primary,
              },
            ]}
            onPress={handleScan}
            disabled={isScanning}
            accessibilityRole="button"
            accessibilityLabel="Scan LifeOps signals and analyze beliefs"
          >
            {isScanning ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="zap" size={16} color={colors.primaryForeground} />
            )}
            <Text
              style={[
                styles.scanButtonText,
                {
                  color: isScanning
                    ? colors.mutedForeground
                    : colors.primaryForeground,
                },
              ]}
            >
              {isScanning ? "Working" : "Scan"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 100 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {!isLoading && totalCount === 0 ? (
          <View style={styles.empty}>
            <Feather name="activity" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No events yet
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              Tap Scan to pull nonclinical screen text, notifications, and other
              text signals already collected by LifeOps.
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
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: -3 },
  summaryRow: { flexDirection: "row", gap: 8 },
  summaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  summaryText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  pipelineCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
  },
  pipelineCopy: { flex: 1, gap: 5 },
  pipelineTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  pipelineTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modelBadge: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.7 },
  pipelineStatus: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  scanButton: {
    minWidth: 72,
    height: 42,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  scanButtonText: { fontSize: 13, fontFamily: "Inter_700Bold" },

  scroll: { paddingHorizontal: 20, gap: 10, paddingTop: 4 },

  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: 120,
  },
  sourceText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  time: { fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: "auto" },
  content: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  mood: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize",
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusText: { fontSize: 12, fontFamily: "Inter_400Regular" },

  empty: { alignItems: "center", paddingVertical: 60, gap: 16 },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
});
