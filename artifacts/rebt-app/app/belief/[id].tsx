import React from 'react';
import { Alert, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGetBeliefQueryKey, useGetBelief, useUpdateBelief, useCreateOpenaiConversation } from '@workspace/api-client-react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import Animated, { FadeInDown, useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useModality } from '@/contexts/ModalityContext';

const AnimatedPressable = Animated.createAnimatedComponent(TouchableOpacity);

const StatusButton = ({ active, onPress, colors, icon, label }: any) => {
  const scale = useSharedValue(1);
  return (
    <AnimatedPressable
      style={[styles.outlineBtn, { borderColor: colors.border, transform: [{ scale }] }]}
      onPressIn={() => scale.value = withSpring(0.95)}
      onPressOut={() => scale.value = withSpring(1)}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather name={icon as any} size={16} color={colors.foreground} />
      <Text style={[styles.outlineBtnText, { color: colors.foreground }]}>{label}</Text>
    </AnimatedPressable>
  );
};

export default function BeliefDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const beliefId = parseInt(id, 10);
  
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { modality } = useModality();
  const activeColor = modality === 'rebt' ? colors.accent : colors.cbt;

  const { data: belief, isLoading, isError, refetch } = useGetBelief(beliefId, {
    query: { queryKey: getGetBeliefQueryKey(beliefId), enabled: Number.isFinite(beliefId) },
  });
  const updateBelief = useUpdateBelief();
  const createConversation = useCreateOpenaiConversation();

  const handleChallenge = async () => {
    Haptics.selectionAsync();
    try {
      let convId = belief?.conversationId;
      if (!convId) {
        const conv = await createConversation.mutateAsync({
          data: { title: 'Work on Belief', beliefId, modality }
        });
        convId = conv.id;
        await updateBelief.mutateAsync({
          id: beliefId,
          data: { conversationId: convId, status: 'challenged' }
        });
        refetch();
      }
      router.push(`/coach-session/${convId}?modality=${modality}`);
    } catch (e) {
      console.error(e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Could not start session', 'Check your connection and try again.');
    }
  };

  const handleToggleStatus = async (newStatus: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await updateBelief.mutateAsync({
        id: beliefId,
        data: { status: newStatus }
      });
      refetch();
    } catch (e) {
      console.error(e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Could not update belief', 'Check your connection and try again.');
    }
  };

  if (!Number.isFinite(beliefId) || isError || (!isLoading && !belief)) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Feather name="alert-circle" size={28} color={colors.destructive} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>Belief unavailable</Text>
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>Check your connection or return to the previous screen.</Text>
        {Number.isFinite(beliefId) ? (
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: activeColor }]} onPress={() => refetch()}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  if (isLoading || !belief) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'catastrophizing':
      case 'awfulizing': return { bg: '#F59E0B', fg: '#000000' };
      case 'global_rating': return { bg: '#6366F1', fg: '#FFFFFF' };
      case 'should_statements': return { bg: '#14B8A6', fg: '#FFFFFF' };
      case 'low_frustration_tolerance': return { bg: '#F43F5E', fg: '#FFFFFF' };
      default: return { bg: colors.accent, fg: colors.accentForeground };
    }
  };

  const badgeColors = getBadgeColor(belief.beliefType);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        
        <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.header}>
          <View style={[styles.badge, { backgroundColor: badgeColors.bg, shadowColor: badgeColors.bg, shadowOpacity: 0.6, shadowRadius: 8, elevation: 4 }]}>
            <Text style={[styles.badgeText, { color: badgeColors.fg }]}>
              {belief.beliefType.replace('_', ' ')}
            </Text>
          </View>
          
          <View style={[styles.statusBadge, { borderColor: colors.border }]}>
            <View style={[
              styles.statusDot, 
              { backgroundColor: belief.status === 'resolved' ? '#10B981' : belief.status === 'challenged' ? colors.primary : colors.destructive }
            ]} />
            <Text style={[styles.statusText, { color: colors.foreground }]}>{belief.status}</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(600).springify()} style={[styles.section, { borderLeftWidth: 4, borderLeftColor: '#F59E0B', paddingLeft: 16 }]}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>The Belief</Text>
          <Text style={[styles.beliefText, { color: colors.foreground }]}>{belief.beliefText}</Text>
        </Animated.View>

        {belief.triggerSituation && (
          <Animated.View entering={FadeInDown.delay(200).duration(600).springify()}>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Feather name="zap" size={16} color={colors.mutedForeground} />
                <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>Trigger Situation</Text>
              </View>
              <Text style={[styles.cardText, { color: colors.cardForeground }]}>{belief.triggerSituation}</Text>
            </View>
          </Animated.View>
        )}

        {belief.emotionalConsequence && (
          <Animated.View entering={FadeInDown.delay(300).duration(600).springify()}>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Feather name="heart" size={16} color={colors.mutedForeground} />
                <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>Emotional Consequence</Text>
              </View>
              <Text style={[styles.cardText, { color: colors.cardForeground }]}>{belief.emotionalConsequence}</Text>
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(400).duration(600).springify()} style={styles.actions}>
          <TouchableOpacity
            style={[styles.challengeBtn, { overflow: 'hidden' }]}
            onPress={handleChallenge}
            disabled={createConversation.isPending || updateBelief.isPending}
            activeOpacity={0.8}
          >
             <LinearGradient colors={modality === 'rebt' ? ['#D4823A', '#A86127'] : ['#4A8A9E', '#35697A']} style={StyleSheet.absoluteFill} />
             <View style={[StyleSheet.absoluteFill, { shadowColor: activeColor, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 }]} />
            {createConversation.isPending ? (
               <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Feather name="message-circle" size={20} color={colors.primaryForeground} />
                <Text style={[styles.challengeBtnText, { color: colors.primaryForeground }]}>
                   {belief.conversationId ? 'Continue Session' : 'Work this belief'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.statusActions}>
             {belief.status !== 'resolved' && (
                <StatusButton 
                  icon="check" 
                   label="Mark Less Active"
                  colors={colors} 
                  onPress={() => handleToggleStatus('resolved')} 
                />
             )}
             {belief.status === 'resolved' && (
                <StatusButton 
                  icon="refresh-ccw" 
                  label="Reopen" 
                  colors={colors} 
                  onPress={() => handleToggleStatus('active')} 
                />
             )}
          </View>
        </Animated.View>

      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', marginTop: 12 },
  errorText: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 6, textAlign: 'center' },
  retryBtn: { marginTop: 18, minHeight: 48, paddingHorizontal: 24, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#000', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 20, gap: 24, paddingTop: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  badgeText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontFamily: 'Inter_500Medium', textTransform: 'capitalize' },
  section: { gap: 8 },
  label: { fontSize: 14, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 1 },
  beliefText: { fontSize: 24, fontFamily: 'Inter_700Bold', lineHeight: 32 },
  card: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  cardText: { fontSize: 16, fontFamily: 'Inter_400Regular', lineHeight: 24 },
  actions: { marginTop: 16, gap: 16 },
  challengeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 14, gap: 8 },
  challengeBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  statusActions: { flexDirection: 'row', justifyContent: 'center' },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 14, borderWidth: 1, gap: 8 },
  outlineBtnText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
});
