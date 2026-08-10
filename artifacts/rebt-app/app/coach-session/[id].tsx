import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Alert, StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGetOpenaiConversationQueryKey, useGetOpenaiConversation } from '@workspace/api-client-react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fetch as expoFetch } from 'expo/fetch';
import { KeyboardAvoidingView as KeyboardControllerView } from 'react-native-keyboard-controller';
import Animated, {
  FadeIn, SlideInDown, SlideInUp, ZoomIn, ZoomOut,
  useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { useModality } from '@/contexts/ModalityContext';
import { useExerciseById } from '@/hooks/useExerciseCatalog';
import { API_ORIGIN } from '@/constants/api';

const TypingDot = ({ delay }: { delay: number }) => {
  const translateY = useSharedValue(0);
  useEffect(() => {
    translateY.value = withDelay(delay, withRepeat(
      withSequence(withTiming(-8, { duration: 300 }), withTiming(0, { duration: 300 })),
      -1, true,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#6B7194', marginHorizontal: 3 }, style]} />;
};

const TypingIndicator = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', height: 24, paddingHorizontal: 4 }}>
    <TypingDot delay={0} />
    <TypingDot delay={150} />
    <TypingDot delay={300} />
  </View>
);

interface RecommendedExercise {
  id: string;
  title: string;
}

function ExerciseRecommendationCard({
  exercise,
  convId,
  modality,
  activeColor,
  colors,
  onDismiss,
}: {
  exercise: RecommendedExercise;
  convId: number;
  modality: string;
  activeColor: string;
  colors: any;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const { exercise: exerciseMeta } = useExerciseById(exercise.id);
  const minutes = exerciseMeta?.estimatedMinutes ?? null;

  return (
    <Animated.View entering={SlideInUp.springify().damping(18)} style={[styles.recCard, { backgroundColor: colors.card, borderColor: activeColor + '55' }]}>
      <View style={[styles.recCardAccent, { backgroundColor: activeColor }]} />
      <View style={styles.recCardBody}>
        <View style={[styles.recIconBox, { backgroundColor: activeColor + '22' }]}>
          <Feather name={exerciseMeta?.icon as any ?? 'activity'} size={20} color={activeColor} />
        </View>
        <View style={styles.recCardText}>
          <Text style={[styles.recLabel, { color: colors.mutedForeground }]}>Suggested next exercise</Text>
          <Text style={[styles.recTitle, { color: colors.foreground }]}>{exercise.title}</Text>
          {minutes && (
            <Text style={[styles.recMeta, { color: colors.mutedForeground }]}>~{minutes} min</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss exercise recommendation"
        >
          <Feather name="x" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.recStartBtn, { backgroundColor: activeColor }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push(`/exercise/${exercise.id}?returnConvId=${convId}&returnModality=${modality}` as any);
          onDismiss();
        }}
      >
        <Feather name="play" size={14} color="#000" />
        <Text style={styles.recStartBtnText}>Start Exercise</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function CoachSessionScreen() {
  const { id, modality: modalityParam, exerciseContext: exerciseContextParam } = useLocalSearchParams<{
    id: string;
    modality?: string;
    exerciseContext?: string;
  }>();
  const convId = parseInt(id, 10);

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { modality: globalModality } = useModality();
  const modality = modalityParam ?? globalModality;

  const isCbtApproach = modality === 'cbt' || modality === 'beck_cbt' || modality === 'team_cbt';
  const activeColor = isCbtApproach ? colors.cbt : colors.accent;

  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [recommendedExercise, setRecommendedExercise] = useState<RecommendedExercise | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // exerciseContext from exercise completion — attach to next outgoing message
  const pendingExerciseContextRef = useRef<string | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);

  const { data: conversation, isLoading, isError, refetch } = useGetOpenaiConversation(convId, {
    query: { queryKey: getGetOpenaiConversationQueryKey(convId), enabled: Number.isFinite(convId) },
  });
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (conversation?.messages) {
      setMessages(conversation.messages);
    }
  }, [conversation]);

  // Pre-fill input with exercise summary when returning from an exercise
  useEffect(() => {
    if (exerciseContextParam) {
      const decoded = decodeURIComponent(exerciseContextParam);
      setInputText(decoded);
      pendingExerciseContextRef.current = decoded;
    }
  }, [exerciseContextParam]);

  useEffect(() => () => requestAbortRef.current?.abort(), []);

  const handleSend = async () => {
    if (isStreaming || !inputText.trim() || !Number.isFinite(convId)) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRecommendedExercise(null);
    setSendError(null);

    const textToSend = inputText.trim();
    const exerciseContext = pendingExerciseContextRef.current;
    pendingExerciseContextRef.current = null;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: textToSend,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsStreaming(true);
    let currentStream = '';
    let responseAccepted = false;
    setStreamedContent('');

    try {
      const controller = new AbortController();
      requestAbortRef.current = controller;
      const response = await expoFetch(
        `${API_ORIGIN}/api/openai/conversations/${convId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: textToSend,
            modality,
            ...(exerciseContext ? { exerciseContext } : {}),
          }),
          signal: controller.signal,
          // @ts-ignore
          reactNative: { textStreaming: true },
        },
      );

      if (!response.ok) {
        throw new Error(`Coach request failed with status ${response.status}`);
      }
      responseAccepted = true;
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            let json: any;
            try {
              json = JSON.parse(line.slice(6));
            } catch {
              continue;
            }
            if (json.error) throw new Error(json.error);
            if (json.content) {
              currentStream += json.content;
              setStreamedContent(currentStream);
            }
            if (json.recommendedExercise) {
              setRecommendedExercise(json.recommendedExercise);
            }
          }
        }
      }

      if (!currentStream.trim()) throw new Error('Coach returned an empty response');
      setMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          role: 'assistant',
          content: currentStream,
          createdAt: new Date().toISOString(),
        },
      ]);
      setStreamedContent('');
    } catch (e) {
      console.error(e);
      if (!(e instanceof Error && e.name === 'AbortError')) {
        if (responseAccepted) {
          setSendError('Your message was saved, but the guide could not complete the reply. The conversation has been refreshed; do not resend it.');
          Alert.alert('Reply interrupted', 'Your message was saved. The conversation will refresh to avoid sending it twice.');
          void refetch();
        } else {
          setMessages((prev) => prev.filter((message) => message.id !== userMessage.id));
          setInputText(textToSend);
          pendingExerciseContextRef.current = exerciseContext;
          setSendError('Your message was not sent. The draft has been restored so you can try again.');
          Alert.alert('Message not sent', 'Check your connection and try again.');
        }
      }
      setStreamedContent('');
    } finally {
      requestAbortRef.current = null;
      setIsStreaming(false);
    }
  };

  const renderBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <Text key={index} style={{ fontFamily: 'Inter_700Bold' }}>{part.slice(2, -2)}</Text>;
      }
      return <Text key={index}>{part}</Text>;
    });
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isUser = item.role === 'user';
    return (
      <Animated.View
        entering={isUser ? SlideInDown.springify().damping(16) : SlideInUp.springify().damping(16)}
        style={[styles.messageContainer, isUser ? styles.messageUser : styles.messageAssistant]}
      >
        <View style={[
          styles.messageBubble,
          isUser
            ? { backgroundColor: activeColor }
            : {
                backgroundColor: colors.card,
                borderLeftWidth: 4,
                borderLeftColor: activeColor,
                shadowColor: activeColor,
                shadowOpacity: 0.3,
                shadowRadius: 8,
                shadowOffset: { width: -2, height: 0 },
                elevation: 4,
              },
        ]}>
          <Text style={[
            styles.messageText,
            { color: isUser ? '#000' : colors.cardForeground },
          ]}>
            {renderBoldText(item.content)}
          </Text>
        </View>
      </Animated.View>
    );
  };

  const reversedMessages = [...messages].reverse();

  const glowOpacity = useSharedValue(0);
  useEffect(() => {
    glowOpacity.value = withTiming(isInputFocused ? 1 : 0, { duration: 300 });
  }, [isInputFocused]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    position: 'absolute',
    top: -1, left: 0, right: 0, height: 2,
    backgroundColor: activeColor,
    shadowColor: activeColor,
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  }));

  if (!Number.isFinite(convId) || isError) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Feather name="alert-circle" size={28} color={colors.destructive} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>Conversation unavailable</Text>
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>Check your connection, then try again.</Text>
        {Number.isFinite(convId) ? (
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: activeColor }]}
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading conversation"
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={activeColor} />
      </View>
    );
  }

  return (
    <KeyboardControllerView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <FlatList
        ref={flatListRef}
        data={reversedMessages}
        keyExtractor={(item, index) => item.id?.toString() || index.toString()}
        renderItem={renderMessage}
        inverted
        contentContainerStyle={[styles.listContent, { paddingBottom: 20 }]}
        ListHeaderComponent={
          isStreaming ? (
            <Animated.View entering={SlideInUp.springify().damping(16)} style={[styles.messageContainer, styles.messageAssistant]}>
              <View style={[
                styles.messageBubble,
                {
                  backgroundColor: colors.card,
                  borderLeftWidth: 4,
                  borderLeftColor: activeColor,
                  shadowColor: activeColor,
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  shadowOffset: { width: -2, height: 0 },
                  elevation: 4,
                },
              ]}>
                {streamedContent ? (
                  <Animated.View entering={FadeIn.duration(300)}>
                    <Text style={[styles.messageText, { color: colors.cardForeground }]}>
                      {renderBoldText(streamedContent)}
                    </Text>
                  </Animated.View>
                ) : (
                  <TypingIndicator />
                )}
              </View>
            </Animated.View>
          ) : null
        }
      />

      {/* Rendered outside the inverted FlatList so scrolling can never
          unmount or clip it — it holds its spot above the input. */}
      {!isStreaming && recommendedExercise ? (
        <View style={styles.recCardDock}>
          <ExerciseRecommendationCard
            exercise={recommendedExercise}
            convId={convId}
            modality={modality}
            activeColor={activeColor}
            colors={colors}
            onDismiss={() => setRecommendedExercise(null)}
          />
        </View>
      ) : null}

      {sendError ? (
        <View style={[styles.sendError, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '55' }]}>
          <Feather name="alert-triangle" size={15} color={colors.destructive} />
          <Text style={[styles.sendErrorText, { color: colors.foreground }]}>{sendError}</Text>
        </View>
      ) : null}

      <View style={[
        styles.inputContainer,
        { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom || 16 },
      ]}>
        <Animated.View style={glowStyle} />
        <TextInput
          style={[styles.input, { backgroundColor: colors.input, color: colors.foreground }]}
          value={inputText}
          onChangeText={setInputText}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
          placeholder={
            modality === 'team_cbt'
              ? 'Share what you want to change—and what makes sense about it...'
              : isCbtApproach
                ? 'Share a specific situation or thought...'
                : 'Share what is on your mind...'
          }
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={1000}
          accessibilityLabel="Message the structured guide"
        />

        <View style={styles.sendButtonWrapper}>
          {inputText.trim() && !isStreaming ? (
            <Animated.View entering={ZoomIn.springify().damping(14)} exiting={ZoomOut.duration(200)}>
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: activeColor }]}
                onPress={handleSend}
                accessibilityRole="button"
                accessibilityLabel="Send message"
              >
                <Feather name="send" size={18} color="#000" />
              </TouchableOpacity>
            </Animated.View>
          ) : null}
        </View>
      </View>
    </KeyboardControllerView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', marginTop: 12 },
  errorText: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 6, textAlign: 'center' },
  retryButton: { marginTop: 18, minHeight: 48, paddingHorizontal: 24, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  retryButtonText: { color: '#000', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  listContent: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  messageContainer: { width: '100%', flexDirection: 'row', marginBottom: 16 },
  messageUser: { justifyContent: 'flex-end' },
  messageAssistant: { justifyContent: 'flex-start' },
  messageBubble: { maxWidth: '85%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  messageText: { fontSize: 16, fontFamily: 'Inter_400Regular', lineHeight: 24 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, gap: 12,
  },
  sendError: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8 },
  sendErrorText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    fontSize: 16, fontFamily: 'Inter_400Regular',
  },
  sendButtonWrapper: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', paddingBottom: 4 },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  // Recommendation card
  recCardDock: { paddingHorizontal: 16 },
  recCard: {
    marginBottom: 16, borderRadius: 18, borderWidth: 1.5, overflow: 'hidden',
  },
  recCardAccent: { height: 3, width: '100%' },
  recCardBody: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
  },
  recIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recCardText: { flex: 1, gap: 2 },
  recLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', textTransform: 'uppercase', letterSpacing: 0.5 },
  recTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  recMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  recStartBtn: {
    marginHorizontal: 16, marginBottom: 14, borderRadius: 14,
    paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  recStartBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#000' },
});
