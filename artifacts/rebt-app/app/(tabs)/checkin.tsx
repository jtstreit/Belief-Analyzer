import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Linking, Modal, ScrollView } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useCreateTelemetry, useAnalyzePatterns, useCreateOpenaiConversation } from '@workspace/api-client-react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, ZoomIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, withSpring } from 'react-native-reanimated';
import { useModality } from '@/contexts/ModalityContext';

const MOODS = [
  { value: 'Great', icon: 'sun' },
  { value: 'Good', icon: 'smile' },
  { value: 'Neutral', icon: 'meh' },
  { value: 'Hard', icon: 'cloud-rain' },
  { value: 'Rough', icon: 'zap' },
];

const MoodPill = ({ m, isSelected, onPress, colors }: any) => {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withSpring(isSelected ? 1.15 : 1, { damping: 12 });
  }, [isSelected]);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: isSelected ? colors.primary : 'transparent',
    borderWidth: 1,
    shadowColor: isSelected ? colors.primary : 'transparent',
    shadowOpacity: isSelected ? 0.8 : 0,
    shadowRadius: 12,
    elevation: isSelected ? 6 : 0,
  }));

  return (
    <Animated.View style={[styles.moodButtonContainer, animatedStyle]}>
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.moodButtonInner}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Mood: ${m.value}`}
        accessibilityState={{ selected: isSelected }}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isSelected ? colors.primary : colors.card, borderRadius: 16 }]} />
        <Feather name={m.icon as any} size={24} color={isSelected ? colors.primaryForeground : colors.mutedForeground} />
        <Text style={[styles.moodText, { color: isSelected ? colors.primaryForeground : colors.mutedForeground }]}>{m.value}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function CheckInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { modality } = useModality();

  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [thought, setThought] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedBeliefs, setAnalyzedBeliefs] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [telemetrySaved, setTelemetrySaved] = useState(false);

  const createTelemetry = useCreateTelemetry();
  const analyzePatterns = useAnalyzePatterns();
  const createConversation = useCreateOpenaiConversation();

  const closeResults = () => {
    setShowModal(false);
    setThought('');
    setSelectedMood(null);
    setTelemetrySaved(false);
  };

  const handleAnalyze = async () => {
    if (!thought.trim() && !selectedMood) return;

    setIsAnalyzing(true);
    setCheckinError(null);
    let saved = telemetrySaved;

    try {
      if (!saved) {
        await createTelemetry.mutateAsync({
          data: {
            type: 'mood_checkin',
            mood: selectedMood || undefined,
            thoughtText: thought.trim() || undefined,
          },
        });
        saved = true;
        setTelemetrySaved(true);
      }

      if (thought.trim()) {
        const beliefs = await analyzePatterns.mutateAsync({ data: { modality } });
        if (beliefs && beliefs.length > 0) {
          setAnalyzedBeliefs(beliefs);
          setShowModal(true);
        } else {
          setThought('');
          setSelectedMood(null);
          setTelemetrySaved(false);
        }
      } else {
        setThought('');
        setSelectedMood(null);
        setTelemetrySaved(false);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setCheckinError(saved
        ? 'Your check-in was saved, but analysis did not finish. Try analysis again when you are connected.'
        : 'Your check-in could not be saved. Your text is still here — check your connection and try again.');
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
          modality,
        }
      });
      setShowModal(false);
      setThought('');
      setSelectedMood(null);
      setTelemetrySaved(false);
      router.push(`/coach-session/${conv.id}?modality=${modality}`);
    } catch (e) {
      console.error(e);
      setCheckinError('Could not start a coach session. Check your connection and try again.');
    }
  };

  const thoughtSlide = useSharedValue(60);
  const thoughtOpacity = useSharedValue(0);
  useEffect(() => {
    if (selectedMood) {
      thoughtSlide.value = withSpring(0, { damping: 14 });
      thoughtOpacity.value = withTiming(1, { duration: 300 });
    } else {
      thoughtSlide.value = withSpring(60);
      thoughtOpacity.value = withTiming(0);
    }
  }, [selectedMood]);
  const thoughtStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: thoughtSlide.value }],
    opacity: thoughtOpacity.value
  }));

  const pulse = useSharedValue(1);
  useEffect(() => {
    if (isAnalyzing) {
      pulse.value = withRepeat(withSequence(withTiming(1.04, { duration: 800 }), withTiming(1, { duration: 800 })), -1, true);
    } else {
      pulse.value = withTiming(1);
    }
  }, [isAnalyzing]);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const modalY = useSharedValue(1000);
  useEffect(() => {
    if (showModal) modalY.value = withSpring(0, { damping: 15, stiffness: 100 });
    else modalY.value = withTiming(1000);
  }, [showModal]);
  const modalStyle = useAnimatedStyle(() => ({ transform: [{ translateY: modalY.value }] }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Check-In</Text>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.foreground }]}>How are you feeling?</Text>
          <View style={styles.moodRow}>
            {MOODS.map((m) => (
              <MoodPill
                key={m.value}
                m={m}
                isSelected={selectedMood === m.value}
                colors={colors}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedMood(m.value);
                  setTelemetrySaved(false);
                }}
              />
            ))}
          </View>
        </View>

        <Animated.View style={[styles.section, thoughtStyle]}>
          <Text style={[styles.label, { color: colors.foreground }]}>What's on your mind?</Text>
          <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>
            What are you telling yourself right now?
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, color: colors.foreground, borderColor: colors.border }]}
            placeholder="Type your thoughts here..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
            value={thought}
            onChangeText={(value) => {
              setThought(value);
              setTelemetrySaved(false);
            }}
            maxLength={2000}
            accessibilityLabel="Thoughts for this check-in"
          />
        </Animated.View>

        {checkinError ? (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={[styles.errorBanner, { backgroundColor: '#B9404022', borderColor: '#B9404066' }]}
          >
            <Feather name="alert-triangle" size={15} color="#B94040" />
            <Text style={[styles.errorBannerText, { color: colors.foreground }]}>{checkinError}</Text>
          </Animated.View>
        ) : null}

        <Animated.View style={btnStyle}>
          <TouchableOpacity
            style={[styles.analyzeButton, { backgroundColor: colors.primary, opacity: (!thought && !selectedMood) || isAnalyzing ? 0.7 : 1 }]}
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
         </Animated.View>

        <TouchableOpacity
          onPress={() => Linking.openURL('tel:988')}
          accessibilityRole="link"
          accessibilityLabel="Call 988 Suicide and Crisis Lifeline"
          style={styles.crisisLink}
        >
          <Text style={[styles.crisisText, { color: colors.mutedForeground }]}>In crisis? Call 988 (US/Canada).</Text>
        </TouchableOpacity>
      </KeyboardAwareScrollViewCompat>

      <Modal visible={showModal} transparent animationType="none" onRequestClose={closeResults}>
        <Animated.View entering={FadeIn} style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
          <Animated.View style={[styles.modalContent, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }, modalStyle]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Beliefs Detected</Text>
              <TouchableOpacity onPress={closeResults} style={styles.closeButton}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
               We noticed some possible unhelpful thought patterns. Would you like to examine them with Vera?
            </Text>
            
            <ScrollView style={styles.beliefsList}>
              {analyzedBeliefs.map((belief, index) => (
                <Animated.View key={belief.id} entering={ZoomIn.delay(200 + index * 100)}>
                  <View style={[styles.beliefCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                       <Text style={[styles.challengeText, { color: colors.primaryForeground }]}>Work on this with Vera</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              ))}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, gap: 32 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorBannerText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  title: { fontSize: 32, fontFamily: 'Inter_700Bold' },
  section: { gap: 12 },
  label: { fontSize: 20, fontFamily: 'Inter_600SemiBold' },
  subLabel: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: -8 },
  moodRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  moodButtonContainer: { flexGrow: 1, flexBasis: '30%', minWidth: 88, height: 88, borderRadius: 16 },
  moodButtonInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, overflow: 'hidden' },
  moodText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  input: { minHeight: 160, borderRadius: 16, borderWidth: 1, padding: 16, fontSize: 16, fontFamily: 'Inter_400Regular', lineHeight: 24 },
  analyzeButton: { padding: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  analyzeText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  crisisLink: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  crisisText: { fontSize: 12, fontFamily: 'Inter_500Medium', textAlign: 'center', textDecorationLine: 'underline' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  closeButton: { padding: 4 },
  modalSubtitle: { fontSize: 16, fontFamily: 'Inter_400Regular', marginBottom: 20, lineHeight: 24 },
  beliefsList: { flexGrow: 0 },
  beliefCard: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 12, marginBottom: 12 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  beliefText: { fontSize: 16, fontFamily: 'Inter_400Regular', lineHeight: 24 },
  challengeButton: { padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  challengeText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
