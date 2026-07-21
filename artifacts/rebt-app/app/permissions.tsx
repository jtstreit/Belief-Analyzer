import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGetCognitiveMapQueryKey,
  getGetSentinelStatusQueryKey,
  getListTelemetryQueryKey,
  useAnalyzeCognitive,
  useGetSentinelStatus,
  useSyncSentinel,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";

function PipelineRow({
  icon,
  title,
  detail,
  status,
  healthy,
}: {
  icon: string;
  title: string;
  detail: string;
  status: string;
  healthy: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View
        style={[styles.rowIcon, { backgroundColor: `${colors.primary}18` }]}
      >
        <Feather name={icon as any} size={19} color={colors.primary} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: colors.cardForeground }]}>
          {title}
        </Text>
        <Text style={[styles.rowDetail, { color: colors.mutedForeground }]}>
          {detail}
        </Text>
      </View>
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: healthy ? "#38B77A20" : "#D9903520" },
        ]}
      >
        <View
          style={[
            styles.statusDot,
            { backgroundColor: healthy ? "#38B77A" : "#D99035" },
          ]}
        />
        <Text
          style={[
            styles.statusText,
            { color: healthy ? "#2B8B61" : "#B26F20" },
          ]}
        >
          {status}
        </Text>
      </View>
    </View>
  );
}

export default function DataPipelineScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: status, refetch } = useGetSentinelStatus();
  const sync = useSyncSentinel();
  const analyze = useAnalyzeCognitive();
  const [result, setResult] = useState<string | null>(null);
  const working = sync.isPending || analyze.isPending;

  const runPipeline = async () => {
    if (working) return;
    setResult("Pulling LifeOps signals through the Monarch-work filter…");
    try {
      const synced = await sync.mutateAsync();
      if (synced.ingested > 0) {
        setResult("Opus 4.8 is extracting suspected distortions and beliefs…");
        await analyze.mutateAsync();
      }
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({
          queryKey: getGetSentinelStatusQueryKey(),
        }),
        queryClient.invalidateQueries({ queryKey: getListTelemetryQueryKey() }),
        queryClient.invalidateQueries({
          queryKey: getGetCognitiveMapQueryKey(),
        }),
      ]);
      setResult(
        synced.ingested > 0
          ? `${synced.ingested} new signal${synced.ingested === 1 ? "" : "s"} processed. ${synced.filteredClinical} Monarch-work protected.`
          : `Already current. ${synced.filteredClinical} Monarch-work protected.`,
      );
    } catch {
      setResult(
        "The pipeline could not complete. Check the server credential and try again.",
      );
    }
  };

  const lastSync = status?.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleString()
    : "No successful sync in this server session";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 36 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View
            style={[
              styles.heroIcon,
              { backgroundColor: `${colors.primary}18` },
            ]}
          >
            <Feather name="git-merge" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Data Pipeline
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            LifeOps collects phone-screen telemetry. Belief Analyzer filters it,
            then Opus 4.8 identifies suspected automatic thoughts, distortions,
            beliefs, and core schemas.
          </Text>
        </View>

        <View style={styles.rows}>
          <PipelineRow
            icon="smartphone"
            title="LifeOps Sentinel"
            detail={`Server-side telemetry source · ${lastSync}`}
            status={status?.configured ? "Connected" : "Needs key"}
            healthy={Boolean(status?.configured)}
          />
          <PipelineRow
            icon="shield"
            title="Monarch-work firewall"
            detail="Monarch work and EHR matches are rejected before database storage or AI analysis. Personal location and Microsoft context remains eligible. Raw LifeOps metadata is discarded."
            status="Enabled"
            healthy={status?.clinicalFilterEnabled ?? true}
          />
          <PipelineRow
            icon="cpu"
            title="Cognitive engine"
            detail="Layered extraction: automatic thoughts → distortions → intermediate beliefs → core schemas."
            status="Opus 4.8"
            healthy={status?.model === "claude-opus-4-8"}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: working ? colors.secondary : colors.primary },
          ]}
          onPress={runPipeline}
          disabled={working}
          accessibilityRole="button"
        >
          {working ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="zap" size={17} color={colors.primaryForeground} />
          )}
          <Text
            style={[
              styles.buttonText,
              {
                color: working
                  ? colors.mutedForeground
                  : colors.primaryForeground,
              },
            ]}
          >
            {working ? "Running pipeline…" : "Test sync and analysis"}
          </Text>
        </TouchableOpacity>

        {result && (
          <View
            style={[
              styles.result,
              { backgroundColor: colors.muted, borderColor: colors.border },
            ]}
          >
            <Feather name="activity" size={15} color={colors.primary} />
            <Text style={[styles.resultText, { color: colors.foreground }]}>
              {result}
            </Text>
          </View>
        )}

        <View style={[styles.note, { borderColor: colors.border }]}>
          <Feather name="info" size={15} color={colors.mutedForeground} />
          <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
            This is a personal pattern-finding tool, not a diagnosis. Insights
            are suspected patterns for your review and may be wrong.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, gap: 18 },
  hero: { alignItems: "center", gap: 9, paddingBottom: 4 },
  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 25, fontFamily: "Inter_700Bold" },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  rows: { gap: 11 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  rowDetail: { fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  button: {
    minHeight: 50,
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  result: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 13,
    padding: 12,
  },
  resultText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  note: { flexDirection: "row", gap: 8, borderTopWidth: 1, paddingTop: 14 },
  noteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
});
