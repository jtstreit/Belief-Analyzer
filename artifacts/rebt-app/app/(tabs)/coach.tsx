import React from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListOpenaiConversations, useCreateOpenaiConversation } from '@workspace/api-client-react';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

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

  const renderConversation = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/coach-session/${item.id}`)}
    >
      <View style={styles.cardIcon}>
        <Feather name="message-circle" size={24} color={colors.primary} />
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
    </TouchableOpacity>
  );

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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardIcon: {
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
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
  floatingButtonContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  newSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 30,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  newSessionText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});
