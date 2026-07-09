import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useGetCognitiveMap,
  getGetCognitiveMapQueryKey,
  useAnalyzeCognitive,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// ─── Distortion label map ──────────────────────────────────────────────────
const DISTORTION_LABELS: Record<string, string> = {
  all_or_nothing: 'All-or-Nothing',
  overgeneralization: 'Overgeneralisation',
  mental_filter: 'Mental Filter',
  discounting_positive: 'Discount +',
  mind_reading: 'Mind Reading',
  fortune_telling: 'Fortune Telling',
  magnification: 'Magnification',
  minimization: 'Minimisation',
  emotional_reasoning: 'Emotional Reasoning',
  should_statements: 'Should Statements',
  labeling: 'Labelling',
  personalization: 'Personalisation',
};

const DOMAIN_CONFIG: Record<string, { label: string; color: string }> = {
  helpless: { label: 'Helpless', color: '#6366F1' },
  unlovable: { label: 'Unlovable', color: '#EC4899' },
  worthless: { label: 'Worthless', color: '#EF4444' },
  other: { label: 'Other', color: '#6B7194' },
};

// ─── Confidence bar ────────────────────────────────────────────────────────
function ConfidenceBar({ pct, evidenceCount }: { pct: number; evidenceCount: number }) {
  const colors = useColors();
  const progress = useSharedValue(0);
  React.useEffect(() => {
    progress.value = withTiming(pct / 100, { duration: 900 });
  }, [pct]);
  const bar = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` as unknown as number }));

  return (
    <View style={styles.confRow}>
      <View style={[styles.confTrack, { backgroundColor: colors.secondary }]}>
        <Animated.View style={[styles.confFill, bar]}>
          <LinearGradient
            colors={['#F59E0B', '#6366F1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
      <Text style={[styles.confLabel, { color: colors.mutedForeground }]}>
        {pct}% · ×{evidenceCount}
      </Text>
    </View>
  );
}

// ─── Section header ────────────────────────────────────────────────────────
function LayerHeader({
  number,
  title,
  count,
}: {
  number: string;
  title: string;
  count: number;
}) {
  const colors = useColors();
  return (
    <View style={styles.layerHeader}>
      <View style={[styles.layerBadge, { backgroundColor: colors.accent }]}>
        <Text style={[styles.layerBadgeText, { color: colors.accentForeground }]}>{number}</Text>
      </View>
      <Text style={[styles.layerTitle, { color: colors.foreground }]}>{title}</Text>
      {count > 0 && (
        <View style={[styles.countPill, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.countPillText, { color: colors.secondaryForeground }]}>{count}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────
export default function MindMapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const {
    data: map,
    isLoading,
    refetch,
  } = useGetCognitiveMap({
    query: { queryKey: getGetCognitiveMapQueryKey() },
  });

  const { mutateAsync: runAnalysis } = useAnalyzeCognitive();

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      await runAnalysis();
      await queryClient.invalidateQueries({ queryKey: getGetCognitiveMapQueryKey() });
    } finally {
      setIsAnalyzing(false);
    }
  }, [runAnalysis, queryClient]);

  // Derive distortion aggregate from automatic thoughts
  const distortionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of map?.automaticThoughts ?? []) {
      for (const tag of (t.distortionTags as string[]) ?? []) {
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [map?.automaticThoughts]);

  const hasAnyData =
    (map?.automaticThoughts?.length ?? 0) > 0 ||
    (map?.intermediateBeliefs?.length ?? 0) > 0 ||
    (map?.coreSchemas?.length ?? 0) > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Mind Map</Text>
          {(map?.unprocessedCount ?? 0) > 0 && (
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {map!.unprocessedCount} events awaiting analysis
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.secondary }]}
            onPress={() => router.push('/permissions')}
          >
            <Feather name="settings" size={18} color={colors.secondaryForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.analyzeButton,
              {
                backgroundColor:
                  isAnalyzing || (map?.unprocessedCount ?? 0) === 0
                    ? colors.secondary
                    : colors.primary,
              },
            ]}
            onPress={handleAnalyze}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text
                style={[
                  styles.analyzeText,
                  {
                    color:
                      (map?.unprocessedCount ?? 0) === 0
                        ? colors.mutedForeground
                        : colors.primaryForeground,
                  },
                ]}
              >
                Analyse
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {!hasAnyData && !isLoading ? (
          <Animated.View entering={FadeIn.duration(600)} style={styles.emptyState}>
            <Feather name="layers" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Your map is empty
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              Add mood check-ins or thought entries, then tap Analyse to build your cognitive
              conceptualization.
            </Text>
          </Animated.View>
        ) : (
          <>
            {/* ── Layer 1: Automatic Thoughts ── */}
            <Animated.View entering={FadeInDown.delay(0).duration(500).springify()}>
              <LayerHeader
                number="1"
                title="Automatic Thoughts"
                count={map?.automaticThoughts?.length ?? 0}
              />
              {(map?.automaticThoughts?.length ?? 0) === 0 ? (
                <Text style={[styles.emptyLayer, { color: colors.mutedForeground }]}>
                  No thoughts extracted yet.
                </Text>
              ) : (
                map!.automaticThoughts.slice(0, 6).map((t) => (
                  <View
                    key={t.id}
                    style={[styles.card, { borderColor: colors.border }]}
                  >
                    <LinearGradient
                      colors={['#1E2540', '#141928']}
                      style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
                    />
                    <Text style={[styles.thoughtText, { color: colors.cardForeground }]}>
                      "{t.thoughtText}"
                    </Text>
                    <View style={styles.metaRow}>
                      {t.emotion && (
                        <Text style={[styles.emotion, { color: colors.primary }]}>
                          {t.emotion}
                        </Text>
                      )}
                      {t.intensityPct != null && (
                        <Text style={[styles.intensity, { color: colors.mutedForeground }]}>
                          · {t.intensityPct}%
                        </Text>
                      )}
                    </View>
                    {(t.distortionTags as string[]).length > 0 && (
                      <View style={styles.tagRow}>
                        {(t.distortionTags as string[]).slice(0, 3).map((tag) => (
                          <View
                            key={tag}
                            style={[styles.tag, { backgroundColor: `${colors.accent}22` }]}
                          >
                            <Text style={[styles.tagText, { color: colors.accent }]}>
                              {DISTORTION_LABELS[tag] ?? tag}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))
              )}
            </Animated.View>

            {/* ── Layer 2: Cognitive Distortions ── */}
            <Animated.View entering={FadeInDown.delay(80).duration(500).springify()}>
              <LayerHeader
                number="2"
                title="Cognitive Distortions"
                count={distortionCounts.length}
              />
              {distortionCounts.length === 0 ? (
                <Text style={[styles.emptyLayer, { color: colors.mutedForeground }]}>
                  No distortions identified yet.
                </Text>
              ) : (
                <View
                  style={[styles.card, styles.distCard, { borderColor: colors.border }]}
                >
                  <LinearGradient
                    colors={['#1E2540', '#141928']}
                    style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
                  />
                  <View style={styles.distGrid}>
                    {distortionCounts.map(([tag, count]) => (
                      <View key={tag} style={styles.distItem}>
                        <View
                          style={[styles.distPill, { backgroundColor: `${colors.primary}22` }]}
                        >
                          <Text style={[styles.distPillText, { color: colors.primary }]}>
                            {DISTORTION_LABELS[tag] ?? tag}
                          </Text>
                          <View
                            style={[styles.distCount, { backgroundColor: colors.primary }]}
                          >
                            <Text
                              style={[styles.distCountText, { color: colors.primaryForeground }]}
                            >
                              {count}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </Animated.View>

            {/* ── Layer 3: Intermediate Beliefs ── */}
            <Animated.View entering={FadeInDown.delay(160).duration(500).springify()}>
              <LayerHeader
                number="3"
                title="Intermediate Beliefs"
                count={map?.intermediateBeliefs?.length ?? 0}
              />
              {(map?.intermediateBeliefs?.length ?? 0) === 0 ? (
                <Text style={[styles.emptyLayer, { color: colors.mutedForeground }]}>
                  Needs more thoughts before patterns emerge.
                </Text>
              ) : (
                map!.intermediateBeliefs.map((b) => (
                  <View key={b.id} style={[styles.card, { borderColor: colors.border }]}>
                    <LinearGradient
                      colors={['#1E2540', '#141928']}
                      style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
                    />
                    <View style={styles.beliefHeader}>
                      <View
                        style={[
                          styles.categoryPill,
                          { backgroundColor: `${colors.accent}33` },
                        ]}
                      >
                        <Text style={[styles.categoryText, { color: colors.accent }]}>
                          {b.category}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.beliefText, { color: colors.cardForeground }]}>
                      {b.beliefText}
                    </Text>
                    <ConfidenceBar pct={b.confidence} evidenceCount={b.evidenceCount} />
                  </View>
                ))
              )}
            </Animated.View>

            {/* ── Layer 4: Core Schemas ── */}
            <Animated.View entering={FadeInDown.delay(240).duration(500).springify()}>
              <LayerHeader
                number="4"
                title="Core Schemas"
                count={map?.coreSchemas?.length ?? 0}
              />
              {(map?.coreSchemas?.length ?? 0) === 0 ? (
                <Text style={[styles.emptyLayer, { color: colors.mutedForeground }]}>
                  Core schemas emerge after multiple belief patterns are identified.
                </Text>
              ) : (
                map!.coreSchemas.map((s) => {
                  const domainCfg = DOMAIN_CONFIG[s.domain] ?? DOMAIN_CONFIG.other!;
                  return (
                    <View key={s.id} style={[styles.card, { borderColor: colors.border }]}>
                      <LinearGradient
                        colors={['#1E2540', '#141928']}
                        style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
                      />
                      <View style={styles.beliefHeader}>
                        <View
                          style={[
                            styles.categoryPill,
                            { backgroundColor: `${domainCfg.color}33` },
                          ]}
                        >
                          <Text
                            style={[styles.categoryText, { color: domainCfg.color }]}
                          >
                            {domainCfg.label}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.beliefText, { color: colors.cardForeground }]}>
                        {s.schemaText}
                      </Text>
                      <ConfidenceBar pct={s.confidence} evidenceCount={s.evidenceCount} />
                    </View>
                  );
                })
              )}
            </Animated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  analyzeText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  scroll: { paddingHorizontal: 20, paddingTop: 12, gap: 24 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 16 },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  emptyBody: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  emptyLayer: { fontSize: 14, fontFamily: 'Inter_400Regular', paddingVertical: 8 },

  // Layer section
  layerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  layerBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layerBadgeText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  layerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', flex: 1 },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  countPillText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  // Cards
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
    overflow: 'hidden',
    gap: 10,
  },
  distCard: { padding: 14 },
  thoughtText: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  emotion: { fontSize: 13, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  intensity: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 11, fontFamily: 'Inter_500Medium' },

  // Distortion aggregate
  distGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  distItem: {},
  distPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 4,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  distPillText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  distCount: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distCountText: { fontSize: 11, fontFamily: 'Inter_700Bold' },

  // Beliefs / schemas
  beliefHeader: { flexDirection: 'row' },
  beliefText: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  categoryPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  categoryText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },

  // Confidence bar
  confRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  confTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  confFill: { height: '100%', borderRadius: 3, overflow: 'hidden' },
  confLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', minWidth: 60 },
});
