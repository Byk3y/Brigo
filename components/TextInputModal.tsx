/**
 * Text Input Modal - NotebookLM style for pasting copied text
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import * as Clipboard from 'expo-clipboard';
import { MotiViewCompat as MotiView } from '@/components/MotiViewCompat';

interface TextInputModalProps {
  visible: boolean;
  type: 'text' | 'note';
  onClose: () => void;
  onSave: (title: string, content: string) => void;
  onConvertToWebsite?: (url: string) => void;
}

export default function TextInputModal({
  visible,
  type,
  onClose,
  onSave,
  onConvertToWebsite,
}: TextInputModalProps) {
  const [content, setContent] = useState('');

  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);

  /**
   * Check if input looks like a URL
   */
  const isUrl = (text: string): boolean => {
    const trimmed = text.trim();
    // No spaces allowed in a bare URL check for this context
    if (trimmed.includes(' ')) return false;

    return (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.includes('.com') ||
      trimmed.includes('.org') ||
      trimmed.includes('.edu') ||
      trimmed.includes('.net') ||
      trimmed.includes('.io') ||
      trimmed.includes('.co') ||
      trimmed.includes('www.')
    );
  };


  // Clear inputs when opening/closing
  useEffect(() => {
    if (!visible) {
      setContent('');
    }
  }, [visible]);

  const handleSave = () => {
    if (!content.trim()) return;

    const trimmedContent = content.trim();

    // URL Detection and Conversion Prompt
    if (onConvertToWebsite && isUrl(trimmedContent)) {
      const { Alert } = require('react-native');
      Alert.alert(
        'Import as Website?',
        'It looks like you\'re pasting a URL. Would you like to import the full article text instead of just saving the link?',
        [
          {
            text: 'Keep as Text',
            style: 'cancel',
            onPress: () => {
              proceedWithSave(trimmedContent);
            }
          },
          {
            text: 'Import as Website',
            onPress: () => {
              onConvertToWebsite(trimmedContent);
            }
          }
        ]
      );
      return;
    }

    proceedWithSave(trimmedContent);
  };

  const proceedWithSave = (text: string) => {
    // Generate title from first line or first 30 characters
    const firstLine = text.split('\n')[0];
    const finalTitle = firstLine.length > 30
      ? firstLine.substring(0, 30).trim() + '...'
      : firstLine.trim() || 'Untitled';

    onSave(finalTitle, text);
    onClose();
  };

  const handlePaste = async () => {
    const hasString = await Clipboard.hasStringAsync();
    if (hasString) {
      const text = await Clipboard.getStringAsync();
      setContent((prev) => prev + text);
    }
  };

  const charCount = content.length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Add New Resource</Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!content.trim()}
              style={[
                styles.saveButton,
                { opacity: content.trim() ? 1 : 0.5 }
              ]}
            >
              <Text style={[styles.saveButtonText, { color: '#6366f1' }]}>Add</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 400 }}
              style={styles.headerSection}
            >
              <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.1)' : '#f5f3ff' }]}>
                <Ionicons name="document-text" size={32} color="#6366f1" />
              </View>
              <View style={styles.textSection}>
                <Text style={[styles.mainTitle, { color: colors.text }]}>Paste Copied Text</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Paste research, articles, or transcripts.
                </Text>
              </View>
            </MotiView>

            <View style={styles.form}>
              {/* Content Input Area - Infinite Growth Mode */}
              <View style={[styles.contentWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.contentHeader, { borderBottomColor: colors.border }]}>
                  <TouchableOpacity onPress={handlePaste} style={styles.toolButton}>
                    <Ionicons name="clipboard-outline" size={18} color="#6366f1" />
                    <Text style={styles.toolText}>Paste from Clipboard</Text>
                  </TouchableOpacity>
                  <Text style={[styles.charCount, { color: colors.textMuted }]}>{charCount.toLocaleString()} chars</Text>
                </View>

                <TextInput
                  style={[styles.contentInput, { color: colors.text }]}
                  placeholder="Drop your text here..."
                  placeholderTextColor={colors.textMuted}
                  value={content}
                  onChangeText={setContent}
                  multiline
                  textAlignVertical="top"
                  autoFocus
                  scrollEnabled={false} // This permits the input to expand the container naturally
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Outfit-SemiBold',
  },
  closeButton: {
    padding: 8,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    fontSize: 17,
    fontFamily: 'Outfit-Bold',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 40,
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  textSection: {
    flex: 1,
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTitle: {
    fontSize: 20,
    fontFamily: 'Outfit-Bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
  },
  form: {
    gap: 16,
  },
  contentWrapper: {
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    height: 45,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolText: {
    color: '#6366f1',
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
  },
  charCount: {
    fontSize: 12,
    fontFamily: 'Nunito-Medium',
  },
  contentInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Nunito-Regular',
    padding: 16,
  },
});
