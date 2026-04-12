/**
 * ChatTab - Q&A interface with material
 * MVP: Uses suggested chat pills instead of full chat
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import type { Notebook } from '@/lib/store';
import { MarkdownText } from '@/components/MarkdownText';
import { PreviewSkeleton } from './PreviewSkeleton';
import { MotiView } from 'moti';
import { getTopicEmoji } from '@/lib/emoji-matcher';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { SourceSelectionModal } from './SourceSelectionModal';
import { useNotebookChat } from '@/lib/hooks/useNotebookChat';
import { useStore } from '@/lib/store';
import { useRouter } from 'expo-router';

const EMPTY_ARRAY: any[] = [];

interface ChatTabProps {
  notebook: Notebook;
  onTakeQuiz?: () => void;
  onRetryMaterial?: (materialId: string) => void;
}

const TypingIndicator = ({ color }: { color: string }) => {
  const dot1 = useRef(new Animated.Value(0.4)).current;
  const dot2 = useRef(new Animated.Value(0.4)).current;
  const dot3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animate = (val: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0.4,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.delay(500 - (delay % 500)), // Adjust delay to keep cycle length consistent
        ])
      ).start();
    };

    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, [dot1, dot2, dot3]);

  return (
    <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 8, paddingHorizontal: 4 }}>
      <Animated.View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color, opacity: dot1 }} />
      <Animated.View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color, opacity: dot2 }} />
      <Animated.View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color, opacity: dot3 }} />
    </View>
  );
};

export const ChatTab: React.FC<ChatTabProps> = ({ notebook, onTakeQuiz, onRetryMaterial }) => {
  const isPad = Platform.OS === 'ios' && Platform.isPad;
  const [inputText, setInputText] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>(
    notebook.materials?.map(m => m.id) || []
  );
  const [sourceModalVisible, setSourceModalVisible] = useState(false);
  const router = useRouter();

  const materialCount = notebook.materials?.length || 0;
  const selectedCount = selectedMaterialIds.length;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);

  // Check for cached data at initialization time to prevent flicker
  const hasCachedDataOnMount = useRef(() => {
    const cachedNotebook = useStore.getState().notebooks.find(n => n.id === notebook.id);
    return Array.isArray(cachedNotebook?.chat_messages);
  }).current();

  const [isReadyToShow, setIsReadyToShow] = useState(false);
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const { sendMessage, isStreaming, remainingMessages, limitReached } = useNotebookChat(notebook.id);

  const isExpired = useStore(state => state.isExpired);
  const tier = useStore(state => state.tier);
  const isPremium = tier === 'premium' && !isExpired;

  const chatMessages = useStore(state =>
    state.notebooks.find(n => n.id === notebook.id)?.chat_messages || EMPTY_ARRAY
  );
  const petName = useStore(state => state.petState.name);

  // Auto-update selection when new materials are added
  const prevMaterialCount = useRef(materialCount);
  useEffect(() => {
    if (materialCount > prevMaterialCount.current) {
      const allIds = notebook.materials?.map(m => m.id) || [];
      const newIds = allIds.filter(id => !selectedMaterialIds.includes(id));

      if (newIds.length > 0) {
        setSelectedMaterialIds(prev => {
          if (prev.length === prevMaterialCount.current) {
            return allIds;
          }
          return [...prev, ...newIds];
        });
      }
    }
    prevMaterialCount.current = materialCount;
  }, [materialCount, notebook.materials, selectedMaterialIds]);

  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);

  const getStrategicSynthesis = (overview: string) => {
    if (!overview) return { briefing: '', masteryGap: '' };
    const sentences = overview.split(/[.!?]\s+/);
    if (sentences.length <= 1) return { briefing: overview, masteryGap: '' };
    const briefing = sentences.slice(0, -1).join('. ') + sentences[sentences.length - 2].slice(-1);
    const masteryGap = sentences[sentences.length - 1];
    return { briefing, masteryGap };
  };

  const { briefing, masteryGap } = getStrategicSynthesis(
    notebook.meta?.preview?.overview || notebook.meta?.preview?.tl_dr || ''
  );

  const userEducationLevel = useStore(state => state.educationLevel);
  const hasInitiallyScrolled = useRef(false);
  const isInitialLoadComplete = useRef(hasCachedDataOnMount);
  const initialMessageCount = useRef<number | null>(
    hasCachedDataOnMount
      ? (useStore.getState().notebooks.find(n => n.id === notebook.id)?.chat_messages?.length ?? 0)
      : null
  );
  const hasContentLayouted = useRef(false);
  const isReadyToShowRef = useRef(false);

  const performReveal = () => {
    if (isReadyToShowRef.current) return;
    scrollRef.current?.scrollToEnd({ animated: false });
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
      const currentMessages = useStore.getState().notebooks.find(n => n.id === notebook.id)?.chat_messages || [];
      initialMessageCount.current = currentMessages.length;
      hasInitiallyScrolled.current = true;
      isReadyToShowRef.current = true;
      setIsReadyToShow(true);
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, 60);
  };

  useEffect(() => {
    if (hasCachedDataOnMount) {
      performReveal();
      return;
    }
    const loadMessages = async () => {
      await useStore.getState().loadChatMessages(notebook.id);
      isInitialLoadComplete.current = true;
      if (hasContentLayouted.current && !isReadyToShowRef.current) {
        setTimeout(() => {
          performReveal();
        }, 50);
      }
    };
    loadMessages();
  }, [notebook.id]);

  useEffect(() => {
    if (
      isReadyToShow &&
      hasInitiallyScrolled.current &&
      isInitialLoadComplete.current &&
      initialMessageCount.current !== null &&
      (chatMessages.length > initialMessageCount.current || isStreaming)
    ) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [chatMessages.length, isStreaming, isReadyToShow]);

  const handleContentSizeChange = () => {
    hasContentLayouted.current = true;
    if (!isReadyToShowRef.current && isInitialLoadComplete.current) {
      performReveal();
    }
  };

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    return () => showSubscription.remove();
  }, []);

  const handleTakeQuiz = () => {
    if (notebook.status === 'extracting' || notebook.status === 'pending') return;
    if (onTakeQuiz) onTakeQuiz();
  };

  const handleSend = () => {
    if (!inputText.trim() || isStreaming) return;
    const msg = inputText.trim();
    setInputText('');
    Keyboard.dismiss();
    sendMessage(msg, selectedMaterialIds);
  };

  const stripMarkdown = (text: string): string => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^[\-\*]\s+/gm, '• ')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const handleCopy = async (content: string) => {
    if (!content) return;
    const plainText = stripMarkdown(content);
    await Clipboard.setStringAsync(plainText);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const toggleMaterial = (id: string) => {
    setSelectedMaterialIds(prev =>
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  };

  const selectAllMaterials = () => {
    if (selectedMaterialIds.length === materialCount) {
      setSelectedMaterialIds([]);
    } else {
      setSelectedMaterialIds(notebook.materials.map(m => m.id));
    }
  };

  const isExtracting = notebook.status === 'extracting' || notebook.status === 'pending';
  // Phase 2: removed `isBackgroundProcessing` flag. The whole large-PDF
  // background-queue path was deleted — PDFs over 14 MB are now rejected
  // upfront with a clean user-facing error, so a notebook is never in a
  // "background processing" state. The skeleton + spinner below covers all
  // in-flight processing states.
  const hasExistingContent = !!briefing;

  // Check if any material has truly failed (status failed AND not processed)
  const failedMaterials = notebook.materials?.filter(m => m.status === 'failed' && !m.processed) || [];
  const hasFailedMaterial = failedMaterials.length > 0;
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetryAll = async () => {
    if (!onRetryMaterial || failedMaterials.length === 0) return;
    setIsRetrying(true);
    try {
      for (const material of failedMaterials) {
        await onRetryMaterial(material.id);
      }
    } finally {
      setIsRetrying(false);
    }
  };

  if (isExtracting && !hasExistingContent) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingHorizontal: 24, paddingVertical: 24 }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            marginBottom: isPad ? 32 : 24,
            maxWidth: isPad ? 800 : '100%',
            alignSelf: 'center',
            width: '100%',
          }}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Text style={{ fontSize: isPad ? 64 : 48, marginRight: isPad ? 20 : 12 }}>{notebook.emoji || getTopicEmoji(notebook.title)}</Text>
            </Animated.View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: isPad ? 32 : 24, color: colors.text, marginBottom: isPad ? 8 : 4, fontFamily: 'Nunito-Bold' }}>
                {notebook.title}
              </Text>
              <Text style={{ fontSize: isPad ? 18 : 14, color: colors.textSecondary, fontFamily: 'Nunito-Regular' }}>
                {materialCount} source{materialCount !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          <View>
            <PreviewSkeleton lines={8} />
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 1000 } as any}
              style={{ alignItems: 'center', marginTop: 32 }}
            >
              <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: 16 }} />
              <Text style={{
                fontSize: 16,
                color: colors.textSecondary,
                fontFamily: 'Nunito-Medium',
                textAlign: 'center'
              }}>
                Just a moment...
              </Text>
              <Text style={{
                fontSize: 13,
                color: colors.textMuted,
                fontFamily: 'Nunito-Regular',
                textAlign: 'center',
                marginTop: 8,
                paddingHorizontal: 32
              }}>
                We're extracting the key insights from your document. We'll notify you when it's ready!
              </Text>
            </MotiView>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 140 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: isPad ? 48 : 24,
          paddingVertical: isPad ? 40 : 24,
        }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={handleContentSizeChange}
      >
        <View style={{ maxWidth: isPad ? 800 : '100%', alignSelf: 'center', width: '100%', flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: isPad ? 32 : 24 }}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Text style={{ fontSize: isPad ? 64 : 48, marginRight: isPad ? 20 : 12 }}>{notebook.emoji || getTopicEmoji(notebook.title)}</Text>
            </Animated.View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: isPad ? 32 : 24, color: colors.text, marginBottom: isPad ? 8 : 4, fontFamily: 'Nunito-Bold', flex: 1 }}>
                  {notebook.title}
                </Text>
                {hasFailedMaterial && onRetryMaterial && (
                  <TouchableOpacity
                    onPress={handleRetryAll}
                    disabled={isRetrying}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                      paddingHorizontal: isPad ? 14 : 10,
                      paddingVertical: isPad ? 8 : 6,
                      borderRadius: isPad ? 12 : 8,
                      borderWidth: 1,
                      borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)',
                      gap: 6,
                    }}
                  >
                    {isRetrying ? (
                      <ActivityIndicator size="small" color="#ef4444" />
                    ) : (
                      <>
                        <Ionicons name="refresh" size={isPad ? 18 : 14} color="#ef4444" />
                        <Text style={{ fontSize: isPad ? 14 : 12, color: '#ef4444', fontFamily: 'Nunito-SemiBold' }}>
                          Retry
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              <Text style={{ fontSize: isPad ? 18 : 14, color: colors.textSecondary, fontFamily: 'Nunito-Regular' }}>
                {materialCount} source{materialCount !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {!isReadyToShow && (
            <View style={{ marginTop: 8 }}>
              <PreviewSkeleton lines={14} />
            </View>
          )}

          <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
            {userEducationLevel && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)',
                paddingHorizontal: isPad ? 14 : 10,
                paddingVertical: isPad ? 6 : 4,
                borderRadius: 999,
                alignSelf: 'flex-start',
                marginBottom: isPad ? 32 : 24,
                marginTop: isPad ? -24 : -16,
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)',
              }}>
                <Ionicons name="school" size={isPad ? 18 : 14} color="#6366f1" />
                <Text style={{ marginLeft: 6, fontSize: isPad ? 14 : 11, color: '#6366f1', fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Calibrated: {userEducationLevel} Mastery
                </Text>
              </View>
            )}

            {briefing ? (
              <View style={{ marginBottom: 24 }}>
                <View style={{
                  backgroundColor: colors.surface,
                  borderRadius: isPad ? 28 : 20,
                  padding: isPad ? 32 : 20,
                  borderWidth: 1,
                  borderColor: colors.border,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.05,
                  shadowRadius: 12,
                  elevation: 2,
                }}>
                  <Text style={{ fontSize: isPad ? 15 : 13, color: '#6366f1', marginBottom: isPad ? 16 : 12, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Overview
                  </Text>
                  <MarkdownText
                    style={{
                      fontSize: isPad ? 18 : 16,
                      color: colors.text,
                      lineHeight: isPad ? 30 : 26,
                      fontFamily: 'Nunito-Regular'
                    }}
                    highlightColor="#6366f1"
                  >
                    {briefing}
                  </MarkdownText>

                  {masteryGap ? (
                    <MotiView
                      from={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', damping: 15, delay: 500 } as any}
                      style={{
                        backgroundColor: isDarkMode ? 'rgba(249, 115, 22, 0.1)' : 'rgba(249, 115, 22, 0.05)',
                        borderRadius: 12,
                        padding: 16,
                        marginTop: 20,
                        borderWidth: 1,
                        borderColor: isDarkMode ? 'rgba(249, 115, 22, 0.2)' : 'rgba(249, 115, 22, 0.3)',
                        borderLeftWidth: 4,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isPad ? 8 : 4 }}>
                        <Ionicons name="flashlight" size={isPad ? 20 : 16} color="#F97316" />
                        <Text style={{ marginLeft: 8, fontSize: isPad ? 14 : 12, color: '#F97316', fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase' }}>
                          Key Insight
                        </Text>
                      </View>
                      <MarkdownText
                        style={{ fontSize: isPad ? 16 : 14, color: colors.textSecondary, lineHeight: isPad ? 24 : 22, fontFamily: 'Nunito-Medium' }}
                        highlightColor="#F97316"
                      >
                        {masteryGap}
                      </MarkdownText>
                    </MotiView>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={{ flex: 1 }}>
              {chatMessages.length === 0 && !(notebook.meta?.preview?.overview || notebook.meta?.preview?.tl_dr) && (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                  <View style={{ width: 80, height: 80, backgroundColor: colors.surfaceAlt, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Ionicons name="chatbubble-outline" size={32} color="#6366f1" />
                  </View>
                  <Text style={{ fontSize: 18, color: colors.text, marginBottom: 8, fontFamily: 'Nunito-SemiBold' }}>
                    Ask questions about your material
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', maxWidth: 280, fontFamily: 'Nunito-Regular' }}>
                    Chat with your {materialCount} source{materialCount !== 1 ? 's' : ''} to get
                    answers and insights.
                  </Text>
                </View>
              )}

              {chatMessages.map((msg, index) => (
                <View key={msg.id || index} style={{ flexDirection: 'row', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
                  <View style={{ maxWidth: '85%' }}>
                    <View
                      style={{
                        backgroundColor: msg.role === 'user' ? '#3B82F6' : colors.surfaceAlt,
                        borderRadius: isPad ? 24 : 18,
                        borderTopRightRadius: msg.role === 'user' ? 4 : (isPad ? 24 : 18),
                        borderTopLeftRadius: msg.role === 'assistant' ? 4 : (isPad ? 24 : 18),
                        paddingHorizontal: isPad ? 20 : 16,
                        paddingVertical: isPad ? 16 : 12,
                      }}
                    >
                      {msg.role === 'user' ? (
                        <Text style={{ color: '#FFFFFF', fontSize: isPad ? 18 : 16, fontFamily: 'Nunito-Medium' }}>
                          {msg.content}
                        </Text>
                      ) : (
                        msg.content === '' ? (
                          <TypingIndicator color={colors.textSecondary} />
                        ) : (
                          <MarkdownText
                            selectable={false}
                            style={{
                              fontSize: isPad ? 18 : 16,
                              color: colors.text,
                              lineHeight: isPad ? 28 : 24,
                              fontFamily: 'Nunito-Regular',
                            }}
                          >
                            {msg.content}
                          </MarkdownText>
                        )
                      )}
                    </View>
                    {msg.role === 'assistant' && msg.content !== '' && (
                      <TouchableOpacity
                        onPress={() => handleCopy(msg.content)}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          marginTop: 6,
                          paddingVertical: 4,
                          paddingHorizontal: 8,
                          alignSelf: 'flex-start',
                        }}
                      >
                        <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 4, fontFamily: 'Nunito-Regular' }}>
                          Copy
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              <View style={{ height: 20 }} />
            </View>
          </Animated.View>
        </View>
      </ScrollView>

      <View style={{ backgroundColor: colors.background, paddingTop: 8 }}>
        {chatMessages.length === 0 && (
          <View style={{ marginBottom: 8 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 8 }}
            >
              {notebook.meta?.preview?.suggested_questions?.map((question: string, index: number) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    setInputText('');
                    sendMessage(question, selectedMaterialIds);
                  }}
                  style={{
                    backgroundColor: isDarkMode ? '#2d2d30' : '#ffffff',
                    borderRadius: isPad ? 28 : 20,
                    paddingHorizontal: isPad ? 20 : 16,
                    paddingVertical: isPad ? 14 : 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#3a3a3c' : '#e5e5e7',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                >
                  <Ionicons name="chatbubble-outline" size={isPad ? 18 : 14} color={colors.primary} />
                  <Text style={{ fontSize: isPad ? 15 : 13, color: colors.text, marginLeft: 6, fontFamily: 'Nunito-Medium' }}>
                    {question}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                onPress={handleTakeQuiz}
                style={{
                  backgroundColor: isDarkMode ? '#2d2d30' : '#ffffff',
                  borderRadius: isPad ? 28 : 20,
                  paddingHorizontal: isPad ? 20 : 16,
                  paddingVertical: isPad ? 14 : 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#3a3a3c' : '#e5e5e7',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <Ionicons name="help-circle-outline" size={isPad ? 20 : 16} color={colors.primary} />
                <Text style={{ fontSize: isPad ? 15 : 13, color: colors.text, marginLeft: 6, fontFamily: 'Nunito-Medium' }}>
                  Take quiz
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        <View style={{ maxWidth: isPad ? 800 : '100%', alignSelf: 'center', width: '100%' }}>
          {!isInputFocused && inputText.length === 0 && (
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              {!isPremium && remainingMessages !== null && (
                <TouchableOpacity
                  onPress={() => router.push('/upgrade')}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Text
                    style={{
                      fontSize: isPad ? 14 : 12,
                      color: remainingMessages <= 2 ? '#f59e0b' : colors.primary,
                      fontFamily: 'Nunito-SemiBold',
                    }}
                  >
                    {remainingMessages === 0
                      ? '0 messages left today'
                      : `${remainingMessages} message${remainingMessages !== 1 ? 's' : ''} left today`}
                  </Text>
                  <Text
                    style={{
                      fontSize: isPad ? 14 : 12,
                      color: colors.primary,
                      fontFamily: 'Nunito-Medium',
                    }}
                  >
                    • Upgrade for unlimited →
                  </Text>
                </TouchableOpacity>
              )}
              <Text
                style={{
                  fontSize: isPad ? 12 : 10,
                  color: colors.textMuted,
                  textAlign: 'center',
                  marginTop: !isPremium && remainingMessages !== null ? 4 : 0,
                  fontFamily: 'Nunito-Regular',
                  opacity: 0.8,
                }}
              >
                Brigo can be inaccurate, so double-check.
              </Text>
            </View>
          )}

          <TouchableWithoutFeedback onPress={() => inputRef.current?.focus()}>
            <View
              style={{
                borderWidth: 1.5,
                borderColor: isInputFocused ? colors.primary : (isDarkMode ? '#505052' : '#d1d1d6'),
                borderTopLeftRadius: isPad ? 32 : 24,
                borderTopRightRadius: isPad ? 32 : 24,
                backgroundColor: isDarkMode ? '#1e1e20' : '#ffffff',
                minHeight: isInputFocused || inputText.length > 0 ? (isPad ? 100 : 80) : (isPad ? 80 : 60),
                paddingHorizontal: isPad ? 20 : 14,
                paddingVertical: isInputFocused || inputText.length > 0 ? (isPad ? 16 : 12) : (isPad ? 14 : 10),
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 10,
                elevation: 2,
                flexDirection: 'row',
                alignItems: isInputFocused || inputText.length > 0 ? 'flex-start' : 'center',
                borderBottomWidth: 0,
              }}
            >
              <View style={{ flex: 1, flexDirection: isInputFocused || inputText.length > 0 ? 'column' : 'row', alignItems: isInputFocused || inputText.length > 0 ? 'stretch' : 'center' }}>
                <TextInput
                  ref={inputRef}
                  placeholder={`Ask ${petName}...`}
                  placeholderTextColor={colors.textSecondary}
                  style={{
                    flex: 1,
                    color: colors.text,
                    fontSize: isPad ? 18 : 16,
                    fontFamily: 'Nunito-Medium',
                    textAlignVertical: 'top',
                    paddingTop: Platform.OS === 'ios' ? (isInputFocused || inputText.length > 0 ? 4 : 0) : 0,
                    paddingBottom: isInputFocused || inputText.length > 0 ? (isPad ? 50 : 40) : 0,
                  }}
                  value={inputText}
                  onChangeText={setInputText}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  multiline
                />

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: isPad ? 12 : 8,
                    position: (isInputFocused || inputText.length > 0) ? 'absolute' : 'relative',
                    bottom: (isInputFocused || inputText.length > 0) ? 0 : undefined,
                    right: (isInputFocused || inputText.length > 0) ? 0 : undefined,
                  }}
                >
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setSourceModalVisible(true)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isDarkMode ? '#2d2d30' : '#f0f0f2',
                      paddingHorizontal: isPad ? 14 : 10,
                      paddingVertical: isPad ? 8 : 5,
                      borderRadius: isPad ? 18 : 14,
                      gap: 6,
                      borderWidth: 1.5,
                      borderColor: isDarkMode ? '#3a3a3c' : '#e5e5e7',
                    }}
                  >
                    <Ionicons name="library-outline" size={isPad ? 18 : 14} color={colors.text} />
                    <Text style={{ fontSize: isPad ? 15 : 13, color: colors.text, fontFamily: 'Nunito-SemiBold' }}>
                      {selectedCount}
                    </Text>
                    <Ionicons name="chevron-down" size={isPad ? 16 : 12} color={colors.textSecondary} />
                  </TouchableOpacity>

                  {(isInputFocused || inputText.trim().length > 0) && (
                    <TouchableOpacity
                      style={{
                        width: isPad ? 40 : 32,
                        height: isPad ? 40 : 32,
                        borderRadius: isPad ? 20 : 16,
                        backgroundColor: (inputText.trim().length > 0 && !isStreaming) ? '#3B82F6' : (isDarkMode ? '#2d2d30' : '#f0f0f2'),
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onPress={handleSend}
                      disabled={!inputText.trim() || isStreaming}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="arrow-up-outline"
                        size={isPad ? 24 : 18}
                        color={(inputText.trim().length > 0 && !isStreaming) ? '#FFFFFF' : colors.textMuted}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </View>

      <SourceSelectionModal
        visible={sourceModalVisible}
        onDismiss={() => setSourceModalVisible(false)}
        materials={notebook.materials || []}
        selectedMaterialIds={selectedMaterialIds}
        onToggleMaterial={toggleMaterial}
        onSelectAll={selectAllMaterials}
      />
    </KeyboardAvoidingView>
  );
};
