import React from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useGetExerciseSession, getGetExerciseSessionQueryKey } from '@workspace/api-client-react';
import { useExerciseById } from '@/hooks/useExerciseCatalog';

/**
 * Read-only view of a completed exercise session — every saved step
 * response labelled with the exercise definition's step titles.
 */
export default function ExerciseHistoryDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const id = parseInt(sessionId ?? '', 10);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: session, isLoading } = useGetExerciseSession(id, {
    query: { queryKey: getGetExerciseSessionQueryKey(id), enabled: !isNaN(id) },
  });
  const { exercise } = useExerciseById(session?.exerciseId);

  const activeColor = session?.modality === 'cbt' ? '#6366F1' : '#F59E0B';

  if (isLoading || !session) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={{ color: colors.foreground }}>Session not found.</Text>
        )}
      </View>
    );
  }

  const stepData = (session.stepData ?? {}) as Record<string, string | number>;
  const answeredSteps = Object.entries(stepData).filter(
    ([, value]) => value !== null && value !== undefined && `${value}`.trim().length > 0,
  );
  const labelFor = (stepId: string) =>
    exercise?.steps.find((st) => st.id === stepId)?.title ?? stepId.replace(/_/g, ' ');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={[styles.modalityPill, { backgroundColor: activeColor + '22', borderColor: activeColor + '55' }]}>
          <Text style={[styles.modalityPillText, { color: activeColor }]}>
            {session.modality.toUpperCase()}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
        <Animated.View entering={FadeInDown.springify()} style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {exercise?.title ?? session.exerciseId}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {new Date(session.createdAt).toLocaleDateString(undefined, {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            })}
          </Text>
        </Animated.View>

        {(session.moodBefore != null || session.moodAfter != null || session.sudsRating != null) && (
          <View style={[styles.metaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {session.moodBefore != null && (
              <View style={styles.metaItem}>
                <Text style={[styles.metaValue, { color: colors.foreground }]}>{session.moodBefore}/10</Text>
                <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Mood before</Text>
              </View>
            )}
            {session.moodAfter != null && (
              <View style={styles.metaItem}>
                <Text style={[styles.metaValue, { color: session.moodBefore != null && session.moodAfter >= session.moodBefore ? '#10B981' : colors.foreground }]}>
                  {session.moodAfter}/10
                </Text>
                <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Mood after</Text>
              </View>
            )}
            {session.sudsRating != null && (
              <View style={styles.metaItem}>
                <Text style={[styles.metaValue, { color: colors.foreground }]}>{session.sudsRating}</Text>
                <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>SUDS</Text>
              </View>
            )}
          </View>
        )}

        {answeredSteps.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No step responses were saved for this session.
          </Text>
        ) : (
          answeredSteps.map(([stepId, value], index) => (
            <Animated.View
              key={stepId}
              entering={FadeInDown.delay(index * 50).springify()}
              style={[styles.stepCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Text style={[styles.stepTitle, { color: activeColor }]}>{labelFor(stepId)}</Text>
              <Text style={[styles.stepValue, { color: colors.cardForeground }]}>{`${value}`}</Text>
            </Animated.View>
          ))
        )}

        {session.notes ? (
          <View style={[styles.stepCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.stepTitle, { color: colors.mutedForeground }]}>Notes</Text>
            <Text style={[styles.stepValue, { color: colors.cardForeground }]}>{session.notes}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalityPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  modalityPillText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  scroll: { paddingHorizontal: 20, gap: 12 },
  header: { gap: 4, marginBottom: 8 },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  metaCard: {
    flexDirection: 'row', justifyContent: 'space-around',
    borderRadius: 14, borderWidth: 1, paddingVertical: 14, marginBottom: 4,
  },
  metaItem: { alignItems: 'center', gap: 2 },
  metaValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  metaLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  stepCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  stepTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.4 },
  stepValue: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingVertical: 24 },
});
