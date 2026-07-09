import React, { useState, useMemo } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useModality, MODALITY_LABELS } from '@/contexts/ModalityContext';
import {
  EXERCISE_CATALOG, ISSUE_LABELS, CATEGORY_LABELS,
  type Exercise, type Issue, type ExerciseCategory,
} from '@/constants/exercises';

const AnimatedPressable = Animated.createAnimatedComponent(TouchableOpacity);

const ISSUE_FILTERS: (Issue | 'all')[] = [
  'all', 'anxiety', 'social_anxiety', 'low_mood', 'anger',
  'guilt_shame', 'procrastination', 'perfectionism',
];

const CATEGORY_FILTERS: (ExerciseCategory | 'all')[] = [
  'all', 'cognitive_restructuring', 'behavioral', 'imagery',
];

const MODALITY_COLORS = {
  rebt: '#F59E0B',
  cbt:  '#6366F1',
  both: '#10B981',
};

const CATEGORY_ICONS: Record<string, string> = {
  cognitive_restructuring: 'cpu',
  behavioral: 'activity',
  imagery: 'eye',
  psychoeducation: 'book-open',
};

export default function LibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { modality } = useModality();

  const [issueFilter, setIssueFilter] = useState<Issue | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<ExerciseCategory | 'all'>('all');
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    return EXERCISE_CATALOG.filter((ex) => {
      const modalityMatch = showAll
        ? true
        : ex.modality === modality || ex.modality === 'both';
      const issueMatch = issueFilter === 'all' || ex.issues.includes(issueFilter);
      const categoryMatch = categoryFilter === 'all' || ex.category === categoryFilter;
      return modalityMatch && issueMatch && categoryMatch;
    });
  }, [modality, issueFilter, categoryFilter, showAll]);

  const activeColor = modality === 'rebt' ? '#F59E0B' : '#6366F1';

  const renderExercise = ({ item, index }: { item: Exercise; index: number }) => {
    const scale = useSharedValue(1);
    const mColor = MODALITY_COLORS[item.modality];

    return (
      <AnimatedPressable
        entering={FadeInDown.delay(index * 60).springify()}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPressIn={() => { scale.value = withSpring(0.97); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        onPress={() => router.push(`/exercise/${item.id}`)}
      >
        <View style={styles.cardTop}>
          <View style={[styles.iconBox, { backgroundColor: colors.muted }]}>
            <Feather name={item.icon as any} size={20} color={activeColor} />
          </View>
          <View style={styles.cardMeta}>
            <View style={[styles.modalityBadge, { backgroundColor: mColor + '22', borderColor: mColor + '55' }]}>
              <Text style={[styles.modalityBadgeText, { color: mColor }]}>
                {item.modality === 'both' ? 'REBT + CBT' : item.modality.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.cardMin, { color: colors.mutedForeground }]}>
              ~{item.estimatedMinutes} min
            </Text>
          </View>
        </View>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
        <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]} numberOfLines={2}>
          {item.subtitle}
        </Text>
        <View style={styles.cardFooter}>
          <View style={[styles.categoryBadge, { backgroundColor: colors.muted }]}>
            <Feather name={CATEGORY_ICONS[item.category] as any} size={10} color={colors.mutedForeground} />
            <Text style={[styles.categoryText, { color: colors.mutedForeground }]}>
              {CATEGORY_LABELS[item.category]}
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </View>
      </AnimatedPressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Library</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Evidence-based exercises
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.toggleBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
          onPress={() => setShowAll(v => !v)}
        >
          <Text style={[styles.toggleText, { color: showAll ? colors.foreground : colors.mutedForeground }]}>
            {showAll ? 'All' : MODALITY_LABELS[modality].short}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Issue filter */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {ISSUE_FILTERS.map((issue) => {
          const isActive = issueFilter === issue;
          const label = issue === 'all' ? 'All issues' : ISSUE_LABELS[issue];
          return (
            <TouchableOpacity
              key={issue}
              style={[
                styles.chip,
                {
                  backgroundColor: isActive ? activeColor : colors.muted,
                  borderColor: isActive ? activeColor : colors.border,
                },
              ]}
              onPress={() => setIssueFilter(issue)}
            >
              <Text style={[styles.chipText, { color: isActive ? '#000' : colors.mutedForeground }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Category filter */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={[styles.filterScroll, { marginTop: 0 }]}
      >
        {CATEGORY_FILTERS.map((cat) => {
          const isActive = categoryFilter === cat;
          const label = cat === 'all' ? 'All types' : CATEGORY_LABELS[cat];
          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.chip,
                {
                  backgroundColor: isActive ? colors.accent : colors.muted,
                  borderColor: isActive ? colors.accent : colors.border,
                },
              ]}
              onPress={() => setCategoryFilter(cat)}
            >
              <Text style={[styles.chipText, { color: isActive ? '#fff' : colors.mutedForeground }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Result count */}
      <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
        {filtered.length} exercise{filtered.length !== 1 ? 's' : ''}
      </Text>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="inbox" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No exercises match these filters
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderExercise}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  title: { fontSize: 32, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 2 },
  toggleBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginTop: 8,
  },
  toggleText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  filterScroll: { maxHeight: 44, marginBottom: 4 },
  filterRow: { paddingHorizontal: 20, gap: 8, paddingVertical: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
  },
  chipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  resultCount: { fontSize: 12, fontFamily: 'Inter_400Regular', paddingHorizontal: 20, marginBottom: 8 },
  listContent: { paddingHorizontal: 20, gap: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  modalityBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  cardMin: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  cardSubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  categoryText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
