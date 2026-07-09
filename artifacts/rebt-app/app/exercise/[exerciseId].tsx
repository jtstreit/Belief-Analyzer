import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn, FadeInRight, FadeInUp, useAnimatedStyle, useSharedValue, withSpring,
} from 'react-native-reanimated';
import { useModality } from '@/contexts/ModalityContext';
import { getExerciseById, type ExerciseStep } from '@/constants/exercises';
import { useCreateExerciseSession, useUpdateExerciseSession } from '@workspace/api-client-react';

// ─── Step input components ────────────────────────────────────────────────────

function InfoStep({ step, colors }: { step: ExerciseStep; colors: any }) {
  return (
    <View style={[styles.infoBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <Text style={[styles.infoText, { color: colors.foreground }]}>{step.instruction}</Text>
    </View>
  );
}

function TextInputStep({
  step, value, onChange, colors, multiline,
}: { step: ExerciseStep; value: string; onChange: (v: string) => void; colors: any; multiline: boolean }) {
  return (
    <TextInput
      style={[
        styles.input,
        { backgroundColor: colors.input, color: colors.foreground, borderColor: colors.border },
        multiline && styles.inputMultiline,
      ]}
      value={value}
      onChangeText={onChange}
      placeholder={step.placeholder ?? ''}
      placeholderTextColor={colors.mutedForeground}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  );
}

function ChoiceStep({
  step, value, onChange, colors, activeColor,
}: { step: ExerciseStep; value: string; onChange: (v: string) => void; colors: any; activeColor: string }) {
  return (
    <View style={styles.choiceList}>
      {(step.options ?? []).map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[
              styles.choiceItem,
              { backgroundColor: active ? activeColor + '22' : colors.muted, borderColor: active ? activeColor : colors.border },
            ]}
            onPress={() => { Haptics.selectionAsync(); onChange(opt); }}
          >
            <View style={[styles.choiceRadio, { borderColor: active ? activeColor : colors.mutedForeground }]}>
              {active && <View style={[styles.choiceDot, { backgroundColor: activeColor }]} />}
            </View>
            <Text style={[styles.choiceText, { color: active ? colors.foreground : colors.mutedForeground }]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function RatingStep({
  step, value, onChange, colors, activeColor,
}: { step: ExerciseStep; value: number | null; onChange: (v: number) => void; colors: any; activeColor: string }) {
  const min = step.min ?? 0;
  const max = step.max ?? 10;
  const count = max - min + 1;
  const ticks = Array.from({ length: count }, (_, i) => i + min);
  return (
    <View style={styles.ratingContainer}>
      <View style={styles.ratingRow}>
        {ticks.map((n) => {
          const active = value === n;
          return (
            <TouchableOpacity
              key={n}
              style={[
                styles.ratingTick,
                { backgroundColor: active ? activeColor : colors.muted, borderColor: active ? activeColor : colors.border },
              ]}
              onPress={() => { Haptics.selectionAsync(); onChange(n); }}
            >
              <Text style={[styles.ratingTickText, { color: active ? '#000' : colors.mutedForeground }]}>{n}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.ratingLabels}>
        <Text style={[styles.ratingLabel, { color: colors.mutedForeground }]}>{min}</Text>
        <Text style={[styles.ratingLabel, { color: colors.mutedForeground }]}>{max}</Text>
      </View>
    </View>
  );
}

function SudsStep({
  step, value, onChange, colors, activeColor,
}: { step: ExerciseStep; value: number | null; onChange: (v: number) => void; colors: any; activeColor: string }) {
  const BUCKETS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const LABELS: Record<number, string> = { 0: 'None', 25: 'Mild', 50: 'Moderate', 75: 'Strong', 100: 'Extreme' };
  return (
    <View style={styles.sudsContainer}>
      <Text style={[styles.sudsValue, { color: activeColor }]}>{value ?? '--'}</Text>
      <Text style={[styles.sudsSubtext, { color: colors.mutedForeground }]}>
        {value !== null ? (LABELS[Math.round(value / 25) * 25] ?? '') : 'tap to set'}
      </Text>
      <View style={styles.sudsRow}>
        {BUCKETS.map((n) => {
          const active = value === n;
          return (
            <TouchableOpacity
              key={n}
              style={[
                styles.sudsTick,
                {
                  backgroundColor: active ? activeColor : colors.muted,
                  height: 6 + (n / 100) * 24,
                  borderRadius: 4,
                },
              ]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(n); }}
            />
          );
        })}
      </View>
      <View style={styles.sudsRowLabels}>
        <Text style={[styles.sudsRangeLabel, { color: colors.mutedForeground }]}>0</Text>
        <Text style={[styles.sudsRangeLabel, { color: colors.mutedForeground }]}>100</Text>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ExerciseScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { modality } = useModality();

  const exercise = getExerciseById(exerciseId ?? '');

  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [moodBefore, setMoodBefore] = useState<number | null>(null);
  const [moodAfterVal, setMoodAfterVal] = useState<number | null>(null);
  const [showMoodBefore, setShowMoodBefore] = useState(true);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const createSession = useCreateExerciseSession();
  const updateSession = useUpdateExerciseSession();

  const activeColor = modality === 'rebt' ? '#F59E0B' : '#6366F1';

  const setAnswer = useCallback((stepId: string, val: string | number) => {
    setAnswers(prev => ({ ...prev, [stepId]: val }));
  }, []);

  if (!exercise) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>Exercise not found.</Text>
      </View>
    );
  }

  const steps = exercise.steps;
  const currentStep = steps[stepIndex];
  const progress = (stepIndex + 1) / steps.length;
  const isLast = stepIndex === steps.length - 1;

  // ── Mood before gate ────────────────────────────────────────────────────────
  if (showMoodBefore) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
          <View style={[styles.modalityPill, { backgroundColor: activeColor + '22', borderColor: activeColor + '55' }]}>
            <Text style={[styles.modalityPillText, { color: activeColor }]}>{modality.toUpperCase()}</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={[styles.gateContent, { paddingBottom: insets.bottom + 32 }]}>
          <Animated.View entering={FadeInUp.springify()} style={styles.gateInner}>
            <View style={[styles.exerciseIconBox, { backgroundColor: activeColor + '22' }]}>
              <Feather name={exercise.icon as any} size={28} color={activeColor} />
            </View>
            <Text style={[styles.exerciseTitle, { color: colors.foreground }]}>{exercise.title}</Text>
            <Text style={[styles.exerciseSubtitle, { color: colors.mutedForeground }]}>{exercise.subtitle}</Text>
            <View style={[styles.rationaleBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.rationaleLabel, { color: activeColor }]}>Why this works</Text>
              <Text style={[styles.rationaleText, { color: colors.mutedForeground }]}>{exercise.rationale}</Text>
            </View>
            {exercise.caution && (
              <View style={[styles.cautionBox, { backgroundColor: '#F59E0B22', borderColor: '#F59E0B55' }]}>
                <Feather name="alert-triangle" size={14} color="#F59E0B" />
                <Text style={[styles.cautionText, { color: colors.foreground }]}>{exercise.caution}</Text>
              </View>
            )}
            <Text style={[styles.moodGateLabel, { color: colors.foreground }]}>
              How are you feeling right now? (0–10)
            </Text>
            <RatingStep
              step={{ id: 'mood', title: '', instruction: '', type: 'mood', min: 0, max: 10 }}
              value={moodBefore}
              onChange={setMoodBefore}
              colors={colors}
              activeColor={activeColor}
            />
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: moodBefore !== null ? activeColor : colors.muted }]}
              disabled={moodBefore === null}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const s = await createSession.mutateAsync({
                  data: { exerciseId: exercise.id, modality, moodBefore: moodBefore!, completed: false },
                });
                setSessionId(s.id);
                setShowMoodBefore(false);
              }}
            >
              {createSession.isPending ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={[styles.primaryBtnText, { color: moodBefore !== null ? '#000' : colors.mutedForeground }]}>
                  Start — ~{exercise.estimatedMinutes} min
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // ── Completed screen ────────────────────────────────────────────────────────
  if (completed) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <View style={{ flex: 1 }} />
        </View>
        <ScrollView contentContainerStyle={[styles.gateContent, { paddingBottom: insets.bottom + 32 }]}>
          <Animated.View entering={FadeInUp.springify()} style={styles.gateInner}>
            <View style={[styles.doneCircle, { backgroundColor: activeColor }]}>
              <Feather name="check" size={32} color="#000" />
            </View>
            <Text style={[styles.exerciseTitle, { color: colors.foreground }]}>Exercise Complete</Text>
            <Text style={[styles.exerciseSubtitle, { color: colors.mutedForeground }]}>
              Well done. Your responses have been saved.
            </Text>
            <Text style={[styles.moodGateLabel, { color: colors.foreground }]}>
              How are you feeling now? (0–10)
            </Text>
            <RatingStep
              step={{ id: 'moodAfter', title: '', instruction: '', type: 'mood', min: 0, max: 10 }}
              value={moodAfterVal}
              onChange={setMoodAfterVal}
              colors={colors}
              activeColor={activeColor}
            />
            {moodBefore !== null && moodAfterVal !== null && (
              <Animated.View
                entering={FadeIn.duration(400)}
                style={[styles.moodDelta, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Text style={[styles.moodDeltaLabel, { color: colors.mutedForeground }]}>Mood shift</Text>
                <Text style={[styles.moodDeltaValue, { color: moodAfterVal >= moodBefore ? '#10B981' : '#EF4444' }]}>
                  {moodAfterVal >= moodBefore ? '+' : ''}{moodAfterVal - moodBefore} / 10
                </Text>
              </Animated.View>
            )}
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: activeColor }]}
              onPress={async () => {
                if (sessionId && moodAfterVal !== null) {
                  await updateSession.mutateAsync({
                    id: sessionId,
                    data: { moodAfter: moodAfterVal },
                  });
                }
                router.back();
              }}
            >
              <Text style={styles.primaryBtnText}>Done</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={() => router.push('/coach' as any)}
            >
              <Feather name="message-circle" size={16} color={colors.mutedForeground} />
              <Text style={[styles.ghostBtnText, { color: colors.mutedForeground }]}>
                Discuss with coach
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // ── Step runner ─────────────────────────────────────────────────────────────
  const currentValue = answers[currentStep!.id];

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scrollRef.current?.scrollTo({ y: 0, animated: false });

    if (isLast) {
      // Save and complete
      setSaving(true);
      try {
        if (sessionId) {
          await updateSession.mutateAsync({
            id: sessionId,
            data: { stepData: answers, completed: true },
          });
        }
        setCompleted(true);
      } finally {
        setSaving(false);
      }
    } else {
      // Auto-save progress every 3 steps
      if (sessionId && (stepIndex + 1) % 3 === 0) {
        updateSession.mutate({ id: sessionId, data: { stepData: answers } });
      }
      setStepIndex(i => i + 1);
    }
  };

  const canProceed = currentStep!.type === 'info'
    || currentStep!.type === 'multiline'
    || currentStep!.type === 'text'
    || currentValue !== undefined;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => {
            if (stepIndex > 0) {
              setStepIndex(i => i - 1);
            } else {
              router.back();
            }
          }}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
            <Animated.View
              style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: activeColor }]}
            />
          </View>
          <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
            {stepIndex + 1} / {steps.length}
          </Text>
        </View>
        <View style={[styles.modalityPill, { backgroundColor: activeColor + '22', borderColor: activeColor + '55' }]}>
          <Text style={[styles.modalityPillText, { color: activeColor }]}>{modality.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.stepScroll}
        contentContainerStyle={[styles.stepContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View key={stepIndex} entering={FadeInRight.duration(250).springify()}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>{currentStep!.title}</Text>
          {currentStep!.instruction && currentStep!.type !== 'info' && (
            <Text style={[styles.stepInstruction, { color: colors.mutedForeground }]}>
              {currentStep!.instruction}
            </Text>
          )}
          {currentStep!.type === 'info' && (
            <InfoStep step={currentStep!} colors={colors} />
          )}
          {(currentStep!.type === 'text' || currentStep!.type === 'multiline') && (
            <TextInputStep
              step={currentStep!}
              value={(currentValue as string) ?? ''}
              onChange={v => setAnswer(currentStep!.id, v)}
              colors={colors}
              multiline={currentStep!.type === 'multiline'}
            />
          )}
          {currentStep!.type === 'choice' && (
            <ChoiceStep
              step={currentStep!}
              value={(currentValue as string) ?? ''}
              onChange={v => setAnswer(currentStep!.id, v)}
              colors={colors}
              activeColor={activeColor}
            />
          )}
          {currentStep!.type === 'rating' && (
            <RatingStep
              step={currentStep!}
              value={currentValue as number ?? null}
              onChange={v => setAnswer(currentStep!.id, v)}
              colors={colors}
              activeColor={activeColor}
            />
          )}
          {(currentStep!.type === 'suds' || currentStep!.type === 'mood') && (
            <SudsStep
              step={currentStep!}
              value={currentValue as number ?? null}
              onChange={v => setAnswer(currentStep!.id, v)}
              colors={colors}
              activeColor={activeColor}
            />
          )}
        </Animated.View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: canProceed ? activeColor : colors.muted, flex: 1 }]}
          disabled={!canProceed || saving}
          onPress={handleNext}
        >
          {saving ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={[styles.primaryBtnText, { color: canProceed ? '#000' : colors.mutedForeground }]}>
              {isLast ? 'Complete Exercise' : 'Next →'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingBottom: 12, gap: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  progressContainer: { flex: 1, gap: 4 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'right' },
  modalityPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1,
  },
  modalityPillText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  stepScroll: { flex: 1 },
  stepContent: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  stepTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', lineHeight: 28 },
  stepInstruction: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 21 },
  infoBox: { padding: 16, borderRadius: 14, borderWidth: 1 },
  infoText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 21 },
  input: {
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontFamily: 'Inter_400Regular',
  },
  inputMultiline: { minHeight: 120, paddingTop: 14 },
  choiceList: { gap: 8 },
  choiceItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  choiceRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  choiceDot: { width: 10, height: 10, borderRadius: 5 },
  choiceText: { fontSize: 14, fontFamily: 'Inter_400Regular', flex: 1, lineHeight: 20 },
  ratingContainer: { gap: 12 },
  ratingRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  ratingTick: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ratingTickText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  ratingLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  ratingLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  sudsContainer: { alignItems: 'center', gap: 8 },
  sudsValue: { fontSize: 48, fontFamily: 'Inter_700Bold' },
  sudsSubtext: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  sudsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 40 },
  sudsTick: { flex: 1 },
  sudsRowLabels: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  sudsRangeLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1,
  },
  primaryBtn: {
    borderRadius: 28, paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
  },
  primaryBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#000' },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12,
  },
  ghostBtnText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  gateContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },
  gateInner: { alignItems: 'center', gap: 16 },
  exerciseIconBox: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  exerciseTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  exerciseSubtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 21, paddingHorizontal: 16 },
  rationaleBox: { width: '100%', borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  rationaleLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  rationaleText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  cautionBox: { width: '100%', borderRadius: 16, borderWidth: 1, padding: 16, flexDirection: 'row', gap: 10 },
  cautionText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, flex: 1 },
  moodGateLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold', textAlign: 'center', marginTop: 8 },
  doneCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  moodDelta: { borderRadius: 16, borderWidth: 1, padding: 16, alignItems: 'center', gap: 4, width: '100%' },
  moodDeltaLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  moodDeltaValue: { fontSize: 28, fontFamily: 'Inter_700Bold' },
});
