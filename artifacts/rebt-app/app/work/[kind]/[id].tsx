import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getGetCognitiveMapQueryKey,
  useCreateOpenaiConversation,
  useGetCognitiveMap,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog';

type FocusKind = 'automatic-thought' | 'intermediate-belief';
type CoachingApproach = 'team_cbt' | 'beck_cbt' | 'rebt';

const QUICK_THOUGHT_IDS = [
  'cbt-quick-distortions',
  'cbt-quick-examine-evidence',
  'cbt-quick-be-specific',
  'cbt-quick-shades-of-gray',
  'cbt-quick-define-terms',
  'cbt-quick-double-standard',
] as const;

const QUICK_BELIEF_IDS = [
  'cbt-quick-cost-benefit',
  'cbt-quick-define-terms',
  'cbt-quick-shades-of-gray',
  'cbt-quick-be-specific',
  'cbt-quick-double-standard',
  'cbt-quick-examine-evidence',
] as const;

const APPROACHES: Array<{
  id: CoachingApproach;
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
}> = [
  {
    id: 'team_cbt',
    title: 'TEAM-CBT / Burns',
    subtitle: 'Empathy and agenda setting first, then a method chosen to fit the belief.',
    icon: 'users',
  },
  {
    id: 'beck_cbt',
    title: 'Beckian Socratic',
    subtitle: 'Collaborative guided discovery using a specific recent example.',
    icon: 'compass',
  },
  {
    id: 'rebt',
    title: 'REBT',
    subtitle: 'ABC(DE) plus empirical, logical, and pragmatic disputation.',
    icon: 'zap',
  },
];

export default function FocusWorkbenchScreen() {
  const { kind: kindParam, id: idParam } = useLocalSearchParams<{
    kind: string;
    id: string;
  }>();
  const kind = kindParam as FocusKind;
  const focusId = Number.parseInt(idParam, 10);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [startingApproach, setStartingApproach] =
    useState<CoachingApproach | null>(null);

  const { data: map, isLoading, isError, refetch } = useGetCognitiveMap({
    query: {
      queryKey: getGetCognitiveMapQueryKey(),
      enabled:
        Number.isFinite(focusId) &&
        (kind === 'automatic-thought' || kind === 'intermediate-belief'),
    },
  });
  const { exercises, isLoading: exercisesLoading } = useExerciseCatalog();
  const createConversation = useCreateOpenaiConversation();

  const focus = useMemo(() => {
    if (!map || !Number.isFinite(focusId)) return undefined;
    return kind === 'automatic-thought'
      ? map.automaticThoughts.find((item) => item.id === focusId)
      : map.intermediateBeliefs.find((item) => item.id === focusId);
  }, [focusId, kind, map]);

  const focusText =
    focus && 'thoughtText' in focus ? focus.thoughtText : focus?.beliefText;
  const reviewStatus = focus?.reviewStatus ?? 'unreviewed';
  const quickIds =
    kind === 'automatic-thought' ? QUICK_THOUGHT_IDS : QUICK_BELIEF_IDS;
  const quickExercises = quickIds
    .map((exerciseId) =>
      exercises.find((exercise) => exercise.id === exerciseId),
    )
    .filter((exercise) => exercise != null);

  const startGuided = async (approach: CoachingApproach) => {
    if (!focus || !focusText || createConversation.isPending) return;
    setStartingApproach(approach);
    setError(null);
    try {
      const conversation = await createConversation.mutateAsync({
        data: {
          title:
            kind === 'automatic-thought'
              ? 'Work on endorsed thought'
              : 'Work on endorsed intermediate belief',
          coachingApproach: approach,
          ...(kind === 'automatic-thought'
            ? { automaticThoughtId: focusId }
            : { intermediateBeliefId: focusId }),
        },
      });
      router.push(
        `/coach-session/${conversation.id}?modality=${approach}` as never,
      );
    } catch {
      setError('Could not start the guided session. Check your connection and try again.');
    } finally {
      setStartingApproach(null);
    }
  };

  const startQuickExercise = (exerciseId: string) => {
    if (!focusText) return;
    const params = new URLSearchParams({
      focusKind:
        kind === 'automatic-thought'
          ? 'automatic_thought'
          : 'intermediate_belief',
      focusId: String(focusId),
    });
    router.push(`/exercise/${exerciseId}?${params.toString()}` as never);
  };

  if (
    !Number.isFinite(focusId) ||
    (kind !== 'automatic-thought' && kind !== 'intermediate-belief') ||
    isError ||
    (!isLoading && !focus)
  ) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <Feather name="alert-circle" size={30} color={colors.destructive} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>
          Insight unavailable
        </Text>
        <Text style={[styles.centerText, { color: colors.mutedForeground }]}>
          Return to Belief Insights and choose the thought or belief again.
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={() => refetch()}
        >
          <Text style={{ color: colors.primaryForeground }}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading || !focus || !focusText) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (reviewStatus !== 'endorsed') {
    return (
      <View
        style={[
          styles.center,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top,
            paddingHorizontal: 28,
          },
        ]}
      >
        <Feather name="check-circle" size={34} color={colors.primary} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>
          Review this suggestion first
        </Text>
        <Text style={[styles.centerText, { color: colors.mutedForeground }]}>
          Opus suggestions remain hypotheses. Mark it as “This is mine” or
          “Rings true” in Belief Insights before working on it.
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={{ color: colors.primaryForeground }}>
            Back to Belief Insights
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.secondary }]}
          onPress={() => router.back()}
          accessibilityLabel="Back"
        >
          <Feather
            name="arrow-left"
            size={19}
            color={colors.secondaryForeground}
          />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>
          Choose how to work
        </Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 36 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.focusCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.focusHeader}>
            <View
              style={[
                styles.endorsedPill,
                { backgroundColor: `${colors.primary}20` },
              ]}
            >
              <Feather name="check" size={13} color={colors.primary} />
              <Text style={[styles.endorsedText, { color: colors.primary }]}>
                {kind === 'automatic-thought'
                  ? 'You had this thought'
                  : 'Rings true'}
              </Text>
            </View>
            <Text style={[styles.focusType, { color: colors.mutedForeground }]}>
              {kind === 'automatic-thought'
                ? 'AUTOMATIC THOUGHT'
                : 'INTERMEDIATE BELIEF'}
            </Text>
          </View>
          <Text style={[styles.focusText, { color: colors.cardForeground }]}>
            “{focusText}”
          </Text>
        </View>

        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Quick exercise
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
            A focused worksheet with no conversation. Finish and tap Done.
          </Text>
        </View>

        {exercisesLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <View style={styles.cardList}>
            {quickExercises.map((exercise) => (
              <TouchableOpacity
                key={exercise.id}
                style={[
                  styles.optionCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => startQuickExercise(exercise.id)}
                accessibilityRole="button"
                accessibilityLabel={`Start ${exercise.title}`}
              >
                <View
                  style={[
                    styles.optionIcon,
                    { backgroundColor: `${colors.cbt}20` },
                  ]}
                >
                  <Feather
                    name={(exercise.icon as keyof typeof Feather.glyphMap) ?? 'edit-3'}
                    size={18}
                    color={colors.cbt}
                  />
                </View>
                <View style={styles.optionCopy}>
                  <Text
                    style={[styles.optionTitle, { color: colors.cardForeground }]}
                  >
                    {exercise.title}
                  </Text>
                  <Text
                    style={[
                      styles.optionSubtitle,
                      { color: colors.mutedForeground },
                    ]}
                    numberOfLines={2}
                  >
                    {exercise.subtitle}
                  </Text>
                </View>
                <Text style={[styles.minutes, { color: colors.mutedForeground }]}>
                  {exercise.estimatedMinutes}m
                </Text>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.guidedHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Guided with Opus
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
            Keep this exact focus and choose the framework for the conversation.
          </Text>
        </View>

        <View style={styles.cardList}>
          {APPROACHES.map((approach) => (
            <TouchableOpacity
              key={approach.id}
              style={[
                styles.optionCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => startGuided(approach.id)}
              disabled={createConversation.isPending}
              accessibilityRole="button"
              accessibilityLabel={`Start ${approach.title} guided session`}
            >
              <View
                style={[
                  styles.optionIcon,
                  {
                    backgroundColor:
                      approach.id === 'rebt'
                        ? `${colors.accent}20`
                        : `${colors.cbt}20`,
                  },
                ]}
              >
                {startingApproach === approach.id ? (
                  <ActivityIndicator
                    size="small"
                    color={approach.id === 'rebt' ? colors.accent : colors.cbt}
                  />
                ) : (
                  <Feather
                    name={approach.icon}
                    size={18}
                    color={approach.id === 'rebt' ? colors.accent : colors.cbt}
                  />
                )}
              </View>
              <View style={styles.optionCopy}>
                <Text
                  style={[styles.optionTitle, { color: colors.cardForeground }]}
                >
                  {approach.title}
                </Text>
                <Text
                  style={[
                    styles.optionSubtitle,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {approach.subtitle}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>

        {error ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: `${colors.destructive}12`,
                borderColor: `${colors.destructive}55`,
              },
            ]}
          >
            <Feather name="alert-triangle" size={15} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.foreground }]}>
              {error}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  centerText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 340,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 6,
  },
  topBar: {
    minHeight: 58,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 20, gap: 14 },
  focusCard: { borderWidth: 1, borderRadius: 16, padding: 17, gap: 12 },
  focusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  endorsedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
  },
  endorsedText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  focusType: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.7,
  },
  focusText: { fontSize: 18, fontFamily: 'Inter_600SemiBold', lineHeight: 26 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 19,
    marginTop: 3,
  },
  guidedHeader: { marginTop: 8 },
  cardList: { gap: 9 },
  optionCard: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 12,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCopy: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  optionSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
  },
  minutes: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  errorBanner: {
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginTop: 4,
  },
  errorText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
