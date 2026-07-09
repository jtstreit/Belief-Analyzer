import React from 'react';
import { StyleSheet, Text, View, RefreshControl, ScrollView, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBeliefs, getListBeliefsQueryKey, useGetPatterns } from '@workspace/api-client-react';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

export default function TabOneScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: beliefs, isLoading: isBeliefsLoading, refetch: refetchBeliefs } = useListBeliefs({ status: 'active' }, { query: { queryKey: getListBeliefsQueryKey({ status: 'active' }) } });
  const { data: patterns, isLoading: isPatternsLoading, refetch: refetchPatterns } = useGetPatterns();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const onRefresh = React.useCallback(async () => {
    await Promise.all([refetchBeliefs(), refetchPatterns()]);
  }, [refetchBeliefs, refetchPatterns]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={isBeliefsLoading || isPatternsLoading} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={[styles.greeting, { color: colors.foreground }]}>{getGreeting()}</Text>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{patterns?.activeBeliefs || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Active Beliefs</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{patterns?.recentStreak || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Day Streak</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{patterns?.resolvedBeliefs || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Resolved</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Beliefs</Text>
          {beliefs && beliefs.length > 0 ? (
            beliefs.slice(0, 3).map((belief) => (
              <TouchableOpacity
                key={belief.id}
                style={[styles.beliefCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(`/belief/${belief.id}`)}
              >
                <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.badgeText, { color: colors.accentForeground }]}>{belief.beliefType.replace('_', ' ')}</Text>
                </View>
                <Text style={[styles.beliefText, { color: colors.cardForeground }]} numberOfLines={2}>
                  {belief.beliefText}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No active beliefs right now. Great job!</Text>
          )}
        </View>

        <TouchableOpacity 
          style={[styles.ctaButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(tabs)/coach')}
        >
          <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Start a session</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 32,
  },
  greeting: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    marginTop: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
  },
  beliefCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'capitalize',
  },
  beliefText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    lineHeight: 24,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  ctaButton: {
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  ctaText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});
