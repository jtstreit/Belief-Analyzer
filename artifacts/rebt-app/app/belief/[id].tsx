import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetBelief, useUpdateBelief, useCreateOpenaiConversation } from '@workspace/api-client-react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

export default function BeliefDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const beliefId = parseInt(id, 10);
  
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: belief, isLoading, refetch } = useGetBelief(beliefId);
  const updateBelief = useUpdateBelief();
  const createConversation = useCreateOpenaiConversation();

  const handleChallenge = async () => {
    Haptics.selectionAsync();
    try {
      let convId = belief?.conversationId;
      if (!convId) {
        const conv = await createConversation.mutateAsync({
          data: { title: 'Challenge Belief', beliefId }
        });
        convId = conv.id;
        await updateBelief.mutateAsync({
          id: beliefId,
          data: { conversationId: convId, status: 'challenged' }
        });
        refetch();
      }
      router.push(`/coach-session/${convId}`);
    } catch (e) {
      console.error(e);
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
    }
  };

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
        
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: badgeColors.bg }]}>
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
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>The Belief</Text>
          <Text style={[styles.beliefText, { color: colors.foreground }]}>{belief.beliefText}</Text>
        </View>

        {belief.triggerSituation && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Feather name="zap" size={16} color={colors.mutedForeground} />
              <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>Trigger Situation</Text>
            </View>
            <Text style={[styles.cardText, { color: colors.cardForeground }]}>{belief.triggerSituation}</Text>
          </View>
        )}

        {belief.emotionalConsequence && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Feather name="heart" size={16} color={colors.mutedForeground} />
              <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>Emotional Consequence</Text>
            </View>
            <Text style={[styles.cardText, { color: colors.cardForeground }]}>{belief.emotionalConsequence}</Text>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.challengeBtn, { backgroundColor: colors.primary }]}
            onPress={handleChallenge}
            disabled={createConversation.isPending || updateBelief.isPending}
          >
            {createConversation.isPending ? (
               <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Feather name="message-circle" size={20} color={colors.primaryForeground} />
                <Text style={[styles.challengeBtnText, { color: colors.primaryForeground }]}>
                  {belief.conversationId ? 'Continue Session' : 'Challenge this belief'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.statusActions}>
             {belief.status !== 'resolved' && (
                <TouchableOpacity
                  style={[styles.outlineBtn, { borderColor: colors.border }]}
                  onPress={() => handleToggleStatus('resolved')}
                >
                  <Feather name="check" size={16} color={colors.foreground} />
                  <Text style={[styles.outlineBtnText, { color: colors.foreground }]}>Mark Resolved</Text>
                </TouchableOpacity>
             )}
             {belief.status === 'resolved' && (
                <TouchableOpacity
                  style={[styles.outlineBtn, { borderColor: colors.border }]}
                  onPress={() => handleToggleStatus('active')}
                >
                  <Feather name="refresh-ccw" size={16} color={colors.foreground} />
                  <Text style={[styles.outlineBtnText, { color: colors.foreground }]}>Reopen</Text>
                </TouchableOpacity>
             )}
          </View>
        </View>

      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'capitalize',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textTransform: 'capitalize',
  },
  section: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  beliefText: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    lineHeight: 32,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  cardText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    lineHeight: 24,
  },
  actions: {
    marginTop: 16,
    gap: 16,
  },
  challengeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    gap: 8,
  },
  challengeBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  statusActions: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  outlineBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
});
