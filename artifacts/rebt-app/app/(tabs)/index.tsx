import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getListBeliefsQueryKey, useGetPatterns, useListBeliefs } from '@workspace/api-client-react';
import { useRouter } from 'expo-router';

const palette = {
  amber: '#F0B860',
  amberLight: '#F8CB83',
  amberDeep: '#E79435',
  forest: '#1C2E1F',
  green: '#146B3F',
  sky: '#D6EEFC',
  cream: '#FFF7E8',
  creamMuted: '#F4E8D4',
  inkMuted: '#687067',
  white: '#FFFFFF',
};

type MetricCardProps = {
  backgroundColor: string;
  detail: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value: number;
};

function MetricCard({ backgroundColor, detail, icon, label, value }: MetricCardProps) {
  return (
    <View style={[styles.metricCard, styles.softShadow, { backgroundColor }]}>
      <View style={styles.metricTopRow}>
        <Text style={styles.metricLabel}>{label}</Text>
        <View style={styles.metricIcon}>
          <Feather name={icon} size={15} color={palette.forest} />
        </View>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDetail} numberOfLines={1}>{detail}</Text>
    </View>
  );
}

export default function TabOneScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const {
    data: beliefs,
    isLoading: isBeliefsLoading,
    isError: beliefsError,
    refetch: refetchBeliefs,
  } = useListBeliefs(
    { status: 'active' },
    { query: { queryKey: getListBeliefsQueryKey({ status: 'active' }) } },
  );
  const {
    data: patterns,
    isLoading: isPatternsLoading,
    isError: patternsError,
    refetch: refetchPatterns,
  } = useGetPatterns();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const onRefresh = React.useCallback(async () => {
    await Promise.all([refetchBeliefs(), refetchPatterns()]);
  }, [refetchBeliefs, refetchPatterns]);

  const activeBeliefs = patterns?.activeBeliefs ?? 0;
  const recentStreak = patterns?.recentStreak ?? 0;
  const resolvedBeliefs = patterns?.resolvedBeliefs ?? 0;
  const isRefreshing = isBeliefsLoading || isPatternsLoading;

  return (
    <LinearGradient
      colors={[palette.amberLight, palette.amber, '#EAA84F']}
      locations={[0, 0.56, 1]}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 118 }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={palette.forest}
            colors={[palette.forest]}
          />
        }
      >
        <View style={styles.contentColumn}>
        <View style={styles.brandRow}>
          <View style={styles.brandLockup}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>B</Text>
            </View>
            <Text style={styles.brandName}>BELIEF ANALYZER</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            activeOpacity={0.82}
            onPress={() => router.push('/(tabs)/settings')}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>JS</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.hero, styles.deepShadow]}>
          <View pointerEvents="none" style={styles.heroOrbLarge} />
          <View pointerEvents="none" style={styles.heroOrbSmall} />
          <Text style={styles.eyebrow}>DAILY CLARITY</Text>
          <Text style={styles.greeting}>{getGreeting()}, Jackson</Text>
          <Text style={styles.heroSubtitle}>Name it. Test it. Reframe it.</Text>
          <View style={styles.heroFooter}>
            <View style={styles.streakPill}>
              <Feather name="zap" size={15} color={palette.forest} />
              <Text style={styles.streakText}>
                {recentStreak > 0
                  ? recentStreak + ' day' + (recentStreak === 1 ? '' : 's') + ' in rhythm'
                  : 'Start your rhythm'}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open coach"
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)/coach')}
              style={styles.roundAction}
            >
              <Feather name="arrow-up-right" size={21} color={palette.forest} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <MetricCard
            backgroundColor={palette.sky}
            detail={resolvedBeliefs + ' resolved total'}
            icon="activity"
            label="ACTIVE BELIEFS"
            value={activeBeliefs}
          />
          <MetricCard
            backgroundColor={palette.cream}
            detail="Keep the rhythm going"
            icon="sun"
            label="REFLECTION STREAK"
            value={recentStreak}
          />
        </View>

        <View style={[styles.reflectionCard, styles.softShadow]}>
          <View style={styles.reflectionCopy}>
            <View style={styles.reflectionIcon}>
              <Feather name="edit-3" size={17} color={palette.forest} />
            </View>
            <Text style={styles.panelEyebrow}>QUICK REFLECTION</Text>
            <Text style={styles.reflectionTitle}>What’s taking up space today?</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Begin a reflection"
            activeOpacity={0.86}
            onPress={() => router.push('/(tabs)/checkin')}
            style={styles.reflectionButton}
          >
            <Text style={styles.reflectionButtonText}>Begin reflection</Text>
            <Feather name="arrow-right" size={17} color={palette.cream} />
          </TouchableOpacity>
        </View>

        <View style={[styles.recentPanel, styles.softShadow]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.panelEyebrow}>YOUR PATTERNS</Text>
              <Text style={styles.sectionTitle}>Recent beliefs</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="See all beliefs"
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/beliefs')}
              style={styles.seeAllButton}
            >
              <Text style={styles.seeAllText}>See all</Text>
              <Feather name="arrow-up-right" size={15} color={palette.forest} />
            </TouchableOpacity>
          </View>

          {beliefsError || patternsError ? (
            <TouchableOpacity
              style={styles.errorCard}
              onPress={onRefresh}
              accessibilityRole="button"
              accessibilityLabel="Retry loading home data"
            >
              <Feather name="refresh-cw" size={18} color={palette.forest} />
              <Text style={styles.emptyText}>Couldn’t load your data. Tap to try again.</Text>
            </TouchableOpacity>
          ) : isRefreshing && !beliefs ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={palette.green} />
              <Text style={styles.emptyText}>Gathering your recent patterns…</Text>
            </View>
          ) : beliefs && beliefs.length > 0 ? (
            beliefs.slice(0, 3).map((belief) => (
              <View key={belief.id}>
                <TouchableOpacity
                  activeOpacity={0.86}
                  style={styles.beliefCard}
                  onPress={() =>
                    router.push({
                      pathname: '/belief/[id]',
                      params: { id: String(belief.id) },
                    })
                  }
                >
                  <View style={styles.beliefContent}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{belief.beliefType.replace(/_/g, ' ')}</Text>
                    </View>
                    <Text style={styles.beliefText} numberOfLines={2}>{belief.beliefText}</Text>
                  </View>
                  <Feather name="arrow-up-right" size={18} color={palette.amber} />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Feather name="compass" size={19} color={palette.forest} />
              </View>
              <Text style={styles.emptyTitle}>A clear page</Text>
              <Text style={styles.emptyText}>
                Log a check-in or start a coach session when you’re ready.
              </Text>
            </View>
          )}
        </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
  },
  contentColumn: {
    marginHorizontal: 18,
    gap: 14,
  },
  brandRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.forest,
  },
  brandMarkText: {
    color: palette.cream,
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  brandName: {
    color: palette.forest,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 1.7,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,247,232,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(28,46,31,0.12)',
  },
  avatarText: {
    color: palette.forest,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  hero: {
    minHeight: 224,
    borderRadius: 30,
    backgroundColor: palette.forest,
    padding: 22,
    overflow: 'hidden',
  },
  heroOrbLarge: {
    position: 'absolute',
    width: 156,
    height: 156,
    borderRadius: 78,
    right: -50,
    top: -44,
    backgroundColor: palette.amberDeep,
    opacity: 0.95,
  },
  heroOrbSmall: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    right: 57,
    top: 49,
    borderWidth: 1,
    borderColor: 'rgba(240,184,96,0.35)',
  },
  eyebrow: {
    color: palette.amber,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1.8,
    marginBottom: 12,
  },
  greeting: {
    maxWidth: '82%',
    color: palette.cream,
    fontSize: 31,
    lineHeight: 37,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    color: '#CBD6CC',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
    marginTop: 7,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  streakPill: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: palette.amber,
  },
  streakText: {
    color: palette.forest,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  roundAction: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cream,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 148,
    borderRadius: 25,
    padding: 16,
  },
  metricTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  metricLabel: {
    flex: 1,
    minWidth: 0,
    color: palette.inkMuted,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 1.1,
  },
  metricIcon: {
    width: 31,
    height: 31,
    borderRadius: 15.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.66)',
  },
  metricValue: {
    color: palette.forest,
    fontFamily: 'Inter_700Bold',
    fontSize: 36,
    lineHeight: 41,
    marginTop: 8,
  },
  metricDetail: {
    color: palette.inkMuted,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    marginTop: 'auto',
  },
  reflectionCard: {
    minHeight: 174,
    borderRadius: 27,
    padding: 18,
    backgroundColor: palette.sky,
  },
  reflectionCopy: {
    paddingRight: 8,
  },
  reflectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.white,
    marginBottom: 12,
  },
  panelEyebrow: {
    color: palette.inkMuted,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.35,
    marginBottom: 5,
  },
  reflectionTitle: {
    color: palette.forest,
    fontFamily: 'Inter_700Bold',
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.35,
  },
  reflectionButton: {
    minHeight: 48,
    marginTop: 15,
    paddingHorizontal: 17,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.green,
  },
  reflectionButtonText: {
    color: palette.cream,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  recentPanel: {
    borderRadius: 27,
    padding: 18,
    gap: 12,
    backgroundColor: palette.cream,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 2,
  },
  sectionTitle: {
    color: palette.forest,
    fontFamily: 'Inter_700Bold',
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.35,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingLeft: 8,
  },
  seeAllText: {
    color: palette.forest,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  beliefCard: {
    minHeight: 105,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: palette.forest,
  },
  beliefContent: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 9,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: palette.amberDeep,
  },
  badgeText: {
    color: palette.forest,
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  beliefText: {
    color: palette.cream,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    lineHeight: 20,
  },
  loadingCard: {
    minHeight: 96,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.creamMuted,
  },
  errorCard: {
    minHeight: 96,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F7D8CF',
    borderWidth: 1,
    borderColor: '#DC8E78',
  },
  emptyCard: {
    minHeight: 126,
    borderRadius: 20,
    padding: 17,
    alignItems: 'flex-start',
    backgroundColor: palette.creamMuted,
  },
  emptyIcon: {
    width: 35,
    height: 35,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cream,
    marginBottom: 10,
  },
  emptyTitle: {
    color: palette.forest,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    marginBottom: 4,
  },
  emptyText: {
    flex: 1,
    color: palette.inkMuted,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 19,
  },
  softShadow: {
    shadowColor: palette.forest,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    elevation: 3,
  },
  deepShadow: {
    shadowColor: '#132116',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 7,
  },
});
