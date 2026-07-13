import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, RefreshControl, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBeliefs, getListBeliefsQueryKey, useGetPatterns } from '@workspace/api-client-react';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, SlideInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

const StatCounter = ({ value, label, primary, streak }: { value: number, label: string, primary?: boolean, streak?: boolean }) => {
  const colors = useColors();
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const steps = 30;
    const stepTime = 1500 / steps;
    const increment = value / steps;
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.round(start));
      }
    }, stepTime);
    return () => clearInterval(timer);
  }, [value]);
  
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (streak) {
      pulse.value = withRepeat(withSequence(withTiming(1, { duration: 1000 }), withTiming(0, { duration: 1000 })), -1, true);
    }
  }, [streak]);
  
  const animatedGlow = useAnimatedStyle(() => {
    if (!streak) return {};
    return {
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15 + pulse.value * 0.2,
      shadowRadius: 8 + pulse.value * 6,
      elevation: 3 + pulse.value * 4,
    };
  });

  return (
    <Animated.View style={[styles.statCardContainer, animatedGlow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: primary ? colors.accent : colors.foreground }]}>{count}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </Animated.View>
  );
};

export default function TabOneScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: beliefs, isLoading: isBeliefsLoading, isError: beliefsError, refetch: refetchBeliefs } = useListBeliefs({ status: 'active' }, { query: { queryKey: getListBeliefsQueryKey({ status: 'active' }) } });
  const { data: patterns, isLoading: isPatternsLoading, isError: patternsError, refetch: refetchPatterns } = useGetPatterns();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const onRefresh = React.useCallback(async () => {
    await Promise.all([refetchBeliefs(), refetchPatterns()]);
  }, [refetchBeliefs, refetchPatterns]);

  const ctaGlowPulse = useSharedValue(0.5);
  useEffect(() => {
    ctaGlowPulse.value = withRepeat(withSequence(withTiming(1, { duration: 2000 }), withTiming(0.5, { duration: 2000 })), -1, true);
  }, []);
  const ctaStyle = useAnimatedStyle(() => ({
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: ctaGlowPulse.value * 0.35,
    shadowRadius: 12,
    elevation: 6,
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Animated.ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={isBeliefsLoading || isPatternsLoading} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Animated.Text entering={SlideInDown.duration(800).delay(100).springify().damping(16)} style={[styles.greeting, { color: colors.foreground }]}>
          {getGreeting()}
        </Animated.Text>

        <View style={styles.statsRow}>
          <StatCounter value={patterns?.activeBeliefs || 0} label="Active Beliefs" />
          <StatCounter value={patterns?.recentStreak || 0} label="Day Streak" primary streak />
          <StatCounter value={patterns?.resolvedBeliefs || 0} label="Resolved" />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Beliefs</Text>
          {beliefsError || patternsError ? (
            <TouchableOpacity
              style={[styles.errorCard, { backgroundColor: colors.card, borderColor: colors.destructive }]}
              onPress={onRefresh}
              accessibilityRole="button"
              accessibilityLabel="Retry loading home data"
            >
              <Text style={[styles.emptyText, { color: colors.foreground }]}>Could not load your data. Tap to try again.</Text>
            </TouchableOpacity>
          ) : beliefs && beliefs.length > 0 ? (
            beliefs.slice(0, 3).map((belief, index) => (
              <Animated.View key={belief.id} entering={SlideInDown.delay(200 + index * 80).duration(500).springify()}>
                <TouchableOpacity
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
              </Animated.View>
            ))
          ) : (
            <Animated.Text entering={FadeIn.delay(300)} style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No active beliefs tracked yet. Log a check-in or start a Vera session when you're ready.
            </Animated.Text>
          )}
        </View>

        <Animated.View style={[styles.ctaWrapper, ctaStyle]}>
          <TouchableOpacity 
            style={[styles.ctaButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(tabs)/coach')}
          >
            <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Start a session</Text>
          </TouchableOpacity>
        </Animated.View>

      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, gap: 32 },
  greeting: { fontSize: 28, fontFamily: 'Inter_700Bold', marginTop: 20 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCardContainer: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1, alignItems: 'center', gap: 4, overflow: 'hidden' },
  statValue: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  section: { gap: 16 },
  sectionTitle: { fontSize: 20, fontFamily: 'Inter_600SemiBold' },
  beliefCard: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 12 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  beliefText: { fontSize: 16, fontFamily: 'Inter_400Regular', lineHeight: 24 },
  emptyText: { fontSize: 16, fontFamily: 'Inter_400Regular' },
  errorCard: { padding: 16, borderRadius: 14, borderWidth: 1 },
  ctaWrapper: { marginTop: 16 },
  ctaButton: { padding: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
