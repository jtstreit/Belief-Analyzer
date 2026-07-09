import React, { useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBeliefs, getListBeliefsQueryKey } from '@workspace/api-client-react';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

const FILTERS = ['All', 'Active', 'Challenged', 'Resolved'];

export default function BeliefsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeFilter, setActiveFilter] = useState('All');

  const { data: beliefs, isLoading, refetch } = useListBeliefs(
    activeFilter !== 'All' ? { status: activeFilter.toLowerCase() } : {},
    { query: { queryKey: getListBeliefsQueryKey(activeFilter !== 'All' ? { status: activeFilter.toLowerCase() } : {}) } }
  );

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'catastrophizing':
      case 'awfulizing':
        return { bg: '#F59E0B', fg: '#000000' };
      case 'global_rating':
        return { bg: '#6366F1', fg: '#FFFFFF' };
      case 'should_statements':
        return { bg: '#14B8A6', fg: '#FFFFFF' };
      case 'low_frustration_tolerance':
        return { bg: '#F43F5E', fg: '#FFFFFF' };
      default:
        return { bg: colors.accent, fg: colors.accentForeground };
    }
  };

  const renderBelief = ({ item }: { item: any }) => {
    const badgeColors = getBadgeColor(item.beliefType);
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push(`/belief/${item.id}`)}
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
                      ? '#10B981'
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
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Beliefs</Text>
      
      <View style={styles.filterScroll}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                { backgroundColor: activeFilter === item ? colors.foreground : colors.muted },
              ]}
              onPress={() => setActiveFilter(item)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: activeFilter === item ? colors.background : colors.mutedForeground },
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : beliefs && beliefs.length > 0 ? (
        <FlatList
          data={beliefs}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderBelief}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Feather name="layers" size={32} color={colors.mutedForeground} />
          </View>
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
  container: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  filterScroll: {
    marginBottom: 16,
  },
  filterList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'capitalize',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  beliefText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    lineHeight: 24,
  },
  situationText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
});
