import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBeliefs, getListBeliefsQueryKey } from '@workspace/api-client-react';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, { SlideInRight, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, withSpring } from 'react-native-reanimated';

const FILTERS = ['All', 'Active', 'Challenged', 'Resolved'];

const AnimatedPressable = Animated.createAnimatedComponent(TouchableOpacity);

const getBadgeColor = (type: string, colors: ReturnType<typeof useColors>) => {
  switch (type) {
    case 'catastrophizing':
    case 'awfulizing':
      return { bg: '#FDF0E6', fg: '#C4601A' };
    case 'global_rating':
      return { bg: '#E8F3F7', fg: '#357A93' };
    case 'should_statements':
      return { bg: '#E6F5F0', fg: '#2E8A6A' };
    case 'low_frustration_tolerance':
      return { bg: '#FAEEEE', fg: '#B94040' };
    default:
      return { bg: colors.muted, fg: colors.mutedForeground };
  }
};

// Proper component — hooks (useSharedValue) are illegal inside a bare
// renderItem callback and crash the web renderer.
function BeliefCard({ item, index, onPress }: { item: any; index: number; onPress: () => void }) {
  const colors = useColors();
  const badgeColors = getBadgeColor(item.beliefType, colors);
  const scale = useSharedValue(1);

  return (
    <AnimatedPressable
      entering={SlideInRight.delay(index * 80).springify()}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, transform: [{ scale }] }]}
      onPressIn={() => scale.value = withSpring(0.97)}
      onPressOut={() => scale.value = withSpring(1)}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.badge, { backgroundColor: badgeColors.bg }]}>
          <Text style={[styles.badgeText, { color: badgeColors.fg }]}>
            {item.beliefType.replace('_', ' ')}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  item.status === 'resolved'
                    ? (colors as any).success
                    : item.status === 'challenged'
                    ? colors.primary
                    : colors.destructive,
              },
            ]}
          />
        </View>
      </View>
      <Text style={[styles.beliefText, { color: colors.cardForeground }]} numberOfLines={2}>
        {item.beliefText}
      </Text>
      {item.triggerSituation && (
        <Text style={[styles.situationText, { color: colors.mutedForeground }]} numberOfLines={1}>
          <Feather name="zap" size={12} color={colors.mutedForeground} /> {item.triggerSituation}
        </Text>
      )}
    </AnimatedPressable>
  );
}

export default function BeliefsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeFilter, setActiveFilter] = useState('All');

  const { data: beliefs, isLoading, refetch } = useListBeliefs(
    activeFilter !== 'All' ? { status: activeFilter.toLowerCase() } : {},
    { query: { queryKey: getListBeliefsQueryKey(activeFilter !== 'All' ? { status: activeFilter.toLowerCase() } : {}) } }
  );

  const chipLayouts = useRef<{ [key: string]: { x: number, width: number } }>({}).current;
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);

  const emptyPulse = useSharedValue(1);
  useEffect(() => {
    emptyPulse.value = withRepeat(withSequence(withTiming(1.1, { duration: 1500 }), withTiming(1, { duration: 1500 })), -1, true);
  }, []);
  const emptyStyle = useAnimatedStyle(() => ({ transform: [{ scale: emptyPulse.value }] }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Beliefs</Text>
      
      <View style={styles.filterScroll}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
          {FILTERS.map((item) => (
            <TouchableOpacity
              key={item}
              onLayout={(e) => {
                chipLayouts[item] = e.nativeEvent.layout;
                if (activeFilter === item) {
                  indicatorX.value = e.nativeEvent.layout.x;
                  indicatorW.value = e.nativeEvent.layout.width;
                }
              }}
              style={styles.filterChip}
              onPress={() => {
                setActiveFilter(item);
                if (chipLayouts[item]) {
                  indicatorX.value = withSpring(chipLayouts[item].x, { damping: 15 });
                  indicatorW.value = withSpring(chipLayouts[item].width, { damping: 15 });
                }
              }}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: activeFilter === item ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
          <Animated.View 
            style={[
              { position: 'absolute', bottom: 0, height: 3, borderRadius: 2, backgroundColor: colors.primary },
              useAnimatedStyle(() => ({ transform: [{ translateX: indicatorX.value }], width: indicatorW.value }))
            ]} 
          />
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : beliefs && beliefs.length > 0 ? (
        <FlatList
          data={beliefs}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item, index }) => (
            <BeliefCard item={item} index={index} onPress={() => router.push(`/belief/${item.id}`)} />
          )}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Animated.View style={[styles.emptyIcon, { backgroundColor: colors.muted }, emptyStyle]}>
            <Feather name="layers" size={32} color={colors.mutedForeground} />
          </Animated.View>
          <Text style={[styles.emptyText, { color: colors.foreground }]}>No beliefs found.</Text>
          <Text style={[styles.emptySubtext, { color: colors.mutedForeground }]}>
            {activeFilter === 'All' 
              ? "Complete a check-in to start identifying thought patterns."
              : `No ${activeFilter.toLowerCase()} beliefs at the moment.`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 32, fontFamily: 'Inter_700Bold', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  filterScroll: { marginBottom: 16, height: 40 },
  filterList: { paddingHorizontal: 20, gap: 16, position: 'relative' },
  filterChip: { paddingBottom: 8, justifyContent: 'center' },
  filterText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  listContent: { paddingHorizontal: 20, gap: 16 },
  card: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  beliefText: { fontSize: 16, fontFamily: 'Inter_400Regular', lineHeight: 24 },
  situationText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyText: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptySubtext: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
});