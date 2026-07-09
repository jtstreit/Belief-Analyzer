import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useCreateTelemetry, useAnalyzePatterns, useCreateOpenaiConversation } from '@workspace/api-client-react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

const MOODS = [
  { value: 'Great', icon: 'sun' },
  { value: 'Good', icon: 'smile' },
  { value: 'Neutral', icon: 'meh' },
  { value: 'Hard', icon: 'cloud-rain' },
  { value: 'Rough', icon: 'zap' },
];

export default function CheckInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [thought, setThought] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedBeliefs, setAnalyzedBeliefs] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);

  const createTelemetry = useCreateTelemetry();
  const analyzePatterns = useAnalyzePatterns();
  const createConversation = useCreateOpenaiConversation();

  const handleAnalyze = async () => {
    if (!thought.trim() && !selectedMood) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsAnalyzing(true);

    try {
      await createTelemetry.mutateAsync({
        data: {
          type: 'mood_checkin',
          mood: selectedMood || undefined,
          thoughtText: thought.trim() || undefined,
        },
      });

      if (thought.trim()) {
        const beliefs = await analyzePatterns.mutateAsync();
        if (beliefs && beliefs.length > 0) {
          setAnalyzedBeliefs(beliefs);
          setShowModal(true);
        } else {
          // Check-in saved, no beliefs detected
          setThought('');
          setSelectedMood(null);
          // could show toast
        }
      } else {
        setThought('');
        setSelectedMood(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleChallenge = async (beliefId: number) => {
    Haptics.selectionAsync();
    try {
      const conv = await createConversation.mutateAsync({
        data: {
          title: 'Challenge Belief',
          beliefId: beliefId,
        }
      });
      setShowModal(false);
      setThought('');
      setSelectedMood(null);
      router.push(`/coach-session/${conv.id}`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Check-In</Text>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.foreground }]}>How are you feeling?</Text>
          <View style={styles.moodRow}>
            {MOODS.map((m) => {
              const isSelected = selectedMood === m.value;
              return (
                <TouchableOpacity
                  key={m.value}
                  style={[
                    styles.moodButton,
                    { backgroundColor: isSelected ? colors.primary : colors.card },
                    isSelected && { borderColor: colors.primary }
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedMood(m.value);
                  }}
                >
                  <Feather
                    name={m.icon as any}
                    size={24}
                    color={isSelected ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.moodText,
                      { color: isSelected ? colors.primaryForeground : colors.mutedForeground }
                    ]}
                  >
                    {m.value}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.foreground }]}>What's on your mind?</Text>
          <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>
            What are you telling yourself right now?
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.input,
                color: colors.foreground,
                borderColor: colors.border,
              }
            ]}
            placeholder="Type your thoughts here..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
            value={thought}
            onChangeText={setThought}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.analyzeButton,
            { backgroundColor: colors.primary, opacity: (!thought && !selectedMood) || isAnalyzing ? 0.7 : 1 }
          ]}
          onPress={handleAnalyze}
          disabled={(!thought && !selectedMood) || isAnalyzing}
        >
          {isAnalyzing ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.analyzeText, { color: colors.primaryForeground }]}>
              {thought ? 'Analyze My Thoughts' : 'Save Check-In'}
            </Text>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollViewCompat>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Beliefs Detected</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeButton}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
              We noticed some potential irrational beliefs in your thought. Would you like to challenge them?
            </Text>
            
            <ScrollView style={styles.beliefsList}>
              {analyzedBeliefs.map(belief => (
                <View key={belief.id} style={[styles.beliefCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.badgeText, { color: colors.accentForeground }]}>{belief.beliefType.replace('_', ' ')}</Text>
                  </View>
                  <Text style={[styles.beliefText, { color: colors.cardForeground }]}>
                    {belief.beliefText}
                  </Text>
                  <TouchableOpacity
                    style={[styles.challengeButton, { backgroundColor: colors.primary }]}
                    onPress={() => handleChallenge(belief.id)}
                  >
                    <Text style={[styles.challengeText, { color: colors.primaryForeground }]}>Challenge this belief</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  title: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
  },
  section: {
    gap: 12,
  },
  label: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
  },
  subLabel: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginTop: -8,
  },
  moodRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  moodButton: {
    flex: 1,
    minWidth: 60,
    aspectRatio: 0.8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  moodText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  input: {
    minHeight: 160,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    lineHeight: 24,
  },
  analyzeButton: {
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  analyzeText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },
  closeButton: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    marginBottom: 20,
    lineHeight: 24,
  },
  beliefsList: {
    flexGrow: 0,
  },
  beliefCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 12,
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
  challengeButton: {
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  challengeText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
