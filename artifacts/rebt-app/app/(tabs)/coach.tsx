import React, { useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListOpenaiConversations, useCreateOpenaiConversation } from '@workspace/api-client-react';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const AnimatedPressable = Animated.createAnimatedComponent(TouchableOpacity);

export default function CoachScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: conversations, isLoading, refetch } = useListOpenaiConversations();
  const createConversation = useCreateOpenaiConversation();

  const handleNewSession = async () => {
    Haptics.selectionAsync();
    try {
      const conv = await createConversation.mutateAsync({
        data: { title: 'New Coaching Session' }
      });
      router.push(`/coach-session/${conv.id}`);
    } catch (e) {
      console.error(e);
    }
  };

  const renderConversation = ({ item, index }: { item: any, index: number }) => {
    const scale = useSharedValue(1);
    const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    const isRecent = new Date().getTime() - new Date(item.createdAt).getTime() < 2 * 24 * 60 * 60 * 1000;

    return (
      <AnimatedPressable
        entering={FadeInDown.delay(index * 100).springify()}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, pressStyle]}
        onPressIn={() => scale.value = withSpring(0.96)}
        onPressOut={() => scale.value = withSpring(1)}
        onPress={() => router.push(`/coach-session/${item.id}`)}
      >
        <LinearGradient 
          colors={isRecent ? ['#F59E0B', '#F59E0B00'] : ['#6B7194', '#6B719400']} 
          start={{x: 0, y: 0}} end={{x: 1, y: 0}} 
          style={styles.cardGradient} 
        />
        <View style={styles.cardInner}>
          <View style={styles.cardIcon}>
            <Feather name="message-circle" size={24} color={isRecent ? colors.primary : colors.mutedForeground} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
              {item.title || 'Coaching Session'}
            </Text>
            <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
        </View>
      </AnimatedPressable>
    );
  };

  const fabPulse = useSharedValue(1);
  useEffect(() => {
    fabPulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 1200 }), withTiming(1, { duration: 1200 })), -1, true);
  }, []);
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ scale: fabPulse.value }] }));
  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabPulse.value + 0.15 }],
    opacity: 0.6 - (fabPulse.value - 1) * 4
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>REBT Coach</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Challenge your irrational beliefs
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : conversations && conversations.length > 0 ? (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderConversation}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Feather name="message-circle" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.emptyText, { color: colors.foreground }]}>No sessions yet</Text>
          <Text style={[styles.emptySubtext, { color: colors.mutedForeground }]}>
            Your coach helps you identify and dispute irrational thoughts that cause distress.
          </Text>
        </View>
      )}

      <View style={[styles.floatingButtonContainer, { bottom: insets.bottom + 90 }]}>
        <Animated.View style={[styles.fabGlow, { backgroundColor: '#F59E0B' }, glowStyle]} />
        <Animated.View style={fabStyle}>
          <TouchableOpacity
            style={[styles.newSessionButton, { backgroundColor: colors.primary }]}
            onPress={handleNewSession}
            disabled={createConversation.isPending}
          >
            {createConversation.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Feather name="plus" size={20} color={colors.primaryForeground} />
                <Text style={[styles.newSessionText, { color: colors.primaryForeground }]}>
                  New Session
                </Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  title: { fontSize: 32, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 16, fontFamily: 'Inter_400Regular', marginTop: 4 },
  listContent: { paddingHorizontal: 20, gap: 12 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardGradient: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 24, opacity: 0.2 },
  cardInner: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  cardIcon: { marginRight: 16 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  cardSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyText: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptySubtext: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  floatingButtonContainer: { position: 'absolute', left: 20, right: 20, alignItems: 'center', justifyContent: 'center' },
  fabGlow: { position: 'absolute', width: 160, height: 50, borderRadius: 25 },
  newSessionButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 30, gap: 8, elevation: 5 },
  newSessionText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});