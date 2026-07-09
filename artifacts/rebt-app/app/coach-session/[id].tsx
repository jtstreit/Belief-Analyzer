import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetOpenaiConversation } from '@workspace/api-client-react';
import { useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fetch as expoFetch } from 'expo/fetch';
import { KeyboardAvoidingView as KeyboardControllerView } from 'react-native-keyboard-controller';

export default function CoachSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const convId = parseInt(id, 10);
  
  const colors = useColors();
  const insets = useSafeAreaInsets();
  
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');

  const { data: conversation, isLoading } = useGetOpenaiConversation(convId);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (conversation?.messages) {
      setMessages(conversation.messages);
    }
  }, [conversation]);

  const handleSendBetter = async () => {
    if (!inputText.trim()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const textToSend = inputText.trim();
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
    setStreamedContent('');

    try {
      const response = await expoFetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/openai/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: textToSend }),
        // @ts-ignore
        reactNative: { textStreaming: true },
      });

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
            try {
              const json = JSON.parse(line.slice(6));
              if (json.content) {
                currentStream += json.content;
                setStreamedContent(currentStream);
              }
            } catch {}
          }
        }
      }
      
      // End of stream
      setIsStreaming(false);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          role: 'assistant',
          content: currentStream,
          createdAt: new Date().toISOString(),
        }
      ]);
      setStreamedContent('');
    } catch (e) {
      console.error(e);
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
      <View style={[
        styles.messageContainer,
        isUser ? styles.messageUser : styles.messageAssistant,
      ]}>
        <View style={[
          styles.messageBubble,
          isUser 
            ? { backgroundColor: colors.primary }
            : { backgroundColor: colors.card, borderLeftWidth: 4, borderLeftColor: colors.accent }
        ]}>
          <Text style={[
            styles.messageText,
            { color: isUser ? colors.primaryForeground : colors.cardForeground }
          ]}>
            {renderBoldText(item.content)}
          </Text>
        </View>
      </View>
    );
  };

  // Inverted order for FlatList
  const reversedMessages = [...messages].reverse();

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardControllerView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0} // Header is transparent/handled by stack
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
            <View style={[styles.messageContainer, styles.messageAssistant]}>
              <View style={[
                styles.messageBubble,
                { backgroundColor: colors.card, borderLeftWidth: 4, borderLeftColor: colors.accent }
              ]}>
                <Text style={[styles.messageText, { color: colors.cardForeground }]}>
                  {streamedContent ? renderBoldText(streamedContent) : (
                    <Text style={{ opacity: 0.5 }}>Typing...</Text>
                  )}
                </Text>
              </View>
            </View>
          ) : null
        }
      />
      
      <View style={[
        styles.inputContainer,
        { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom || 16 }
      ]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.input, color: colors.foreground }]}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Message coach..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: inputText.trim() && !isStreaming ? colors.primary : colors.muted }
          ]}
          onPress={handleSendBetter}
          disabled={!inputText.trim() || isStreaming}
        >
          <Feather name="send" size={18} color={inputText.trim() && !isStreaming ? colors.primaryForeground : colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </KeyboardControllerView>
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
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  messageContainer: {
    width: '100%',
    flexDirection: 'row',
    marginBottom: 16,
  },
  messageUser: {
    justifyContent: 'flex-end',
  },
  messageAssistant: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  messageText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    lineHeight: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
