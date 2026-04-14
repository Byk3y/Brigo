/**
 * Material Type Selector Modal
 * Full screen modal for selecting upload material type to create study notebooks
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  Animated as RNAnimated,
  PanResponder,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  Keyboard,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { AnimatedGradientBorder } from '@/components/AnimatedGradientBorder';
import Animated, {
  FadeInUp,
  FadeOutDown,
  Layout,
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  withRepeat,
  withSequence,
  withDelay,
  Easing
} from 'react-native-reanimated';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const isPad = Platform.OS === 'ios' && Platform.isPad;

type MaterialType = 'pdf' | 'audio' | 'image' | 'website' | 'youtube' | 'copied-text';

interface MaterialTypeSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelectType: (type: MaterialType, url?: string) => void;
  notebookId?: string; // If provided, sources will be added to this notebook
}

const CYCLING_WORDS = ['EXAM', 'TEST', 'FINALS', 'MIDTERM', 'SEMESTER'];

const InternalAnimatedWord = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % CYCLING_WORDS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const word = CYCLING_WORDS[index];

  return (
    <View style={{ height: isPad ? 48 : 36, overflow: 'hidden', justifyContent: 'center' }}>
      <Animated.Text
        key={word}
        entering={FadeInUp.duration(600).springify()}
        exiting={FadeOutDown.duration(600).springify()}
        style={{
          fontSize: isPad ? 36 : 27,
          fontWeight: '700',
          color: isDarkMode ? '#00FFD1' : '#2E48FF',
          fontFamily: 'Outfit-Bold',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {word}
      </Animated.Text>
    </View>
  );
};

export default function MaterialTypeSelector({
  visible,
  onClose,
  onSelectType,
  notebookId,
}: MaterialTypeSelectorProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const translateY = useRef(new RNAnimated.Value(SCREEN_HEIGHT)).current;

  // Dark mode support using theme context
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);

  // Track current translateY value
  const currentTranslateY = useRef(0);
  useEffect(() => {
    const listenerId = translateY.addListener(({ value }) => {
      currentTranslateY.current = value;
    });
    return () => {
      translateY.removeListener(listenerId);
    };
  }, []);

  // Animate in when visible changes
  useEffect(() => {
    if (visible) {
      // Stop any ongoing animations and reset state
      translateY.stopAnimation((finalValue) => {
        // Reset to starting position
        translateY.setValue(SCREEN_HEIGHT);
        currentTranslateY.current = SCREEN_HEIGHT;
        // Reset offset to ensure clean state
        translateY.setOffset(0);
        translateY.flattenOffset();

        requestAnimationFrame(() => {
          RNAnimated.timing(translateY, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }).start((finished) => {
            if (finished) {
              currentTranslateY.current = 0;
            }
          });
        });
      });
    } else {
      setSearchQuery('');
      // Reset to bottom when hidden
      translateY.setValue(SCREEN_HEIGHT);
      currentTranslateY.current = SCREEN_HEIGHT;
      translateY.setOffset(0);
      translateY.flattenOffset();
    }
  }, [visible]);

  // Track if there was actual movement (to distinguish tap from drag)
  const hasMoved = useRef(false);

  // PanResponder for swipe down to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        hasMoved.current = false;
        // Stop any ongoing animations first
        translateY.stopAnimation();
        // Set offset to current position and reset value
        translateY.setOffset(currentTranslateY.current);
        translateY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // Mark that we've moved
        if (Math.abs(gestureState.dy) > 5) {
          hasMoved.current = true;
        }
        // Only allow downward movement - follow finger smoothly
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        } else {
          // Allow slight upward movement for better feel
          translateY.setValue(gestureState.dy * 0.3);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        translateY.flattenOffset();

        // Check if it was a tap (no significant movement)
        const totalDistance = Math.abs(gestureState.dy);
        const isTap = !hasMoved.current && totalDistance < 10;

        // Only close if it was a drag (not a tap) and meets threshold
        if (!isTap && (gestureState.dy > 150 || gestureState.vy > 0.7)) {
          // Smoothly animate to close
          RNAnimated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            onClose();
          });
        } else if (!isTap) {
          // Snap back to top if it was a drag but didn't meet threshold
          RNAnimated.spring(translateY, {
            toValue: 0,
            tension: 65,
            friction: 11,
            useNativeDriver: true,
          }).start();
        } else {
          // It was a tap, just reset position smoothly
          RNAnimated.spring(translateY, {
            toValue: 0,
            tension: 65,
            friction: 11,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleClose = () => {
    RNAnimated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  /**
   * Check if input looks like a URL
   */
  const isUrl = (text: string): boolean => {
    return (
      text.startsWith('http://') ||
      text.startsWith('https://') ||
      text.includes('.com') ||
      text.includes('.org') ||
      text.includes('.edu') ||
      text.includes('.net') ||
      text.includes('.io') ||
      text.includes('.co') ||
      text.includes('www.')
    );
  };

  const handleSearch = () => {
    const query = searchQuery.trim();
    if (query) {
      // Check if it's a YouTube URL
      if (query.includes('youtube.com') || query.includes('youtu.be')) {
        handleSelectType('youtube', query);
      } else if (isUrl(query)) {
        // It's a direct URL - process as website
        handleSelectType('website', query);
      } else {
        // It's a topic query - navigate to discover sources
        handleClose();
        setTimeout(() => {
          const params = notebookId
            ? { query, notebookId }
            : { query };
          router.push({
            pathname: '/discover-sources',
            params,
          });
        }, 400);
      }
    }
  };

  const handleSelectType = (type: MaterialType, url?: string) => {
    handleClose();
    // Delay callback to allow animation to complete
    setTimeout(() => {
      onSelectType(type, url);
    }, 400);
  };

  const materialOptions = [
    { type: 'pdf' as MaterialType, iconName: 'description' as const, iconSet: 'MaterialIcons' as const, label: 'PDF', description: 'Upload notes or past papers' },
    { type: 'audio' as MaterialType, iconName: 'equalizer' as const, iconSet: 'MaterialIcons' as const, label: 'Audio', description: 'Record or upload lectures' },
    { type: 'image' as MaterialType, iconName: 'image' as const, iconSet: 'MaterialIcons' as const, label: 'Image', description: 'Scan textbooks or exam sheets (Max 5)' },
    { type: 'website' as MaterialType, iconName: 'globe' as const, iconSet: 'Ionicons' as const, label: 'Website', description: 'Import articles or online docs' },
    { type: 'youtube' as MaterialType, iconName: 'logo-youtube' as const, iconSet: 'Ionicons' as const, label: 'YouTube', description: 'Import educational videos' },
    { type: 'copied-text' as MaterialType, iconName: 'assignment' as const, iconSet: 'MaterialIcons' as const, label: 'Copied text', description: 'Paste notes or question text' },
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <View style={styles.container} pointerEvents="box-none">
        {/* Backdrop */}
        <Pressable style={styles.backdrop} onPress={handleClose} />

        {/* Sheet - 85% of screen height */}
        <RNAnimated.View
          style={[
            styles.sheet,
            {
              height: SCREEN_HEIGHT * 0.95,
              transform: [{ translateY }],
              backgroundColor: colors.background,
            },
          ]}
        >
          <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['bottom']}>
            {/* Handle bar — PanResponder scoped here only. Previously the
                responder covered the whole sheet, which on Android swallows
                taps on the option buttons before TouchableOpacity can
                register them. Scoping to just the drag handle restores
                tap-to-pick-material behavior on Android. */}
            <View
              style={[styles.handleContainer, { backgroundColor: colors.background }]}
              {...panResponder.panHandlers}
            >
              <View style={[styles.handle, { backgroundColor: isDarkMode ? colors.border : '#D1D1D6' }]} />
            </View>

            {/* Close Button */}
            <View style={styles.closeButtonContainer}>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <MaterialIcons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>

            {/* Content - Dismiss keyboard on tap outside */}
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.contentWrapper}>
                {/* Title */}
                <View style={[styles.header, { paddingBottom: isPad ? 40 : 28 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: isPad ? 12 : 8, marginBottom: 2 }}>
                    <Text style={[styles.title, {
                      color: colors.text,
                      marginBottom: 0,
                      fontFamily: 'Outfit-Bold',
                      fontSize: isPad ? 36 : 27,
                      letterSpacing: -0.5,
                    }]}>Crush your next</Text>
                    <InternalAnimatedWord isDarkMode={isDarkMode} />
                  </View>
                  <Text style={{
                    fontSize: isPad ? 22 : 17,
                    color: colors.textSecondary,
                    fontFamily: 'Outfit-Regular',
                    letterSpacing: 0,
                    opacity: 0.8,
                    textAlign: 'center'
                  }}>
                    starting with your resources
                  </Text>
                </View>

                {/* Search Input */}
                <View style={[styles.searchContainer, isPad && { marginBottom: 40 }]}>
                  <AnimatedGradientBorder
                    borderRadius={16}
                    style={{ flex: 1, height: isPad ? 64 : 48 }}
                  >
                    <TextInput
                      style={[
                        styles.searchInput,
                        {
                          backgroundColor: colors.surface,
                          color: colors.text,
                          borderWidth: 0,
                          height: '100%', // Ensure it fills the border container
                          fontSize: isPad ? 20 : 16,
                          paddingHorizontal: isPad ? 24 : 16,
                          borderRadius: 16,
                        }
                      ]}
                      placeholder="Search a topic or paste URL"
                      placeholderTextColor={colors.textMuted}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      onSubmitEditing={handleSearch}
                      returnKeyType="send"
                    />
                  </AnimatedGradientBorder>
                  <TouchableOpacity
                    onPress={handleSearch}
                    style={[
                      styles.sendButton,
                      !searchQuery.trim() && styles.sendButtonDisabled,
                      {
                        backgroundColor: 'transparent',
                        width: isPad ? 64 : 48,
                        height: isPad ? 64 : 48
                      }
                    ]}
                    disabled={!searchQuery.trim()}
                  >
                    <AnimatedGradientBorder
                      borderRadius={isPad ? 32 : 24}
                      style={{ width: isPad ? 64 : 48, height: isPad ? 64 : 48 }}
                    >
                      <View
                        style={{
                          width: '100%',
                          height: '100%',
                          backgroundColor: isDarkMode ? colors.text : '#171717',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <MaterialIcons name="arrow-forward" size={isPad ? 24 : 18} color={isDarkMode ? colors.background : '#FFFFFF'} />
                      </View>
                    </AnimatedGradientBorder>
                  </TouchableOpacity>
                </View>

                {/* Separator */}
                <View style={[styles.separatorContainer, isPad && { marginBottom: 32 }]}>
                  <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
                  <Text style={[styles.separatorText, { color: colors.textSecondary, fontSize: isPad ? 18 : 14 }]}>Or upload your files</Text>
                  <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
                </View>

                {/* Material Type Options */}
                <View style={[styles.optionsContainer, isPad && { gap: 12 }]}>
                  {materialOptions.map((option) => (
                    <TouchableOpacity
                      key={option.type}
                      style={[
                        styles.optionButton,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          paddingVertical: isPad ? 20 : 12,
                          paddingHorizontal: isPad ? 24 : 16,
                        }
                      ]}
                      onPress={() => handleSelectType(option.type)}
                      activeOpacity={0.7}
                    >
                      {option.iconSet === 'Ionicons' ? (
                        <Ionicons
                          name={option.iconName as any}
                          size={isPad ? 28 : 20}
                          color={colors.icon}
                          style={[styles.buttonIcon, isPad && { marginRight: 20 }]}
                        />
                      ) : (
                        <MaterialIcons
                          name={option.iconName as any}
                          size={isPad ? 28 : 20}
                          color={colors.icon}
                          style={[styles.buttonIcon, isPad && { marginRight: 20 }]}
                        />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.buttonLabel, { color: colors.text, fontSize: isPad ? 20 : 16 }]}>{option.label}</Text>
                        <Text style={{
                          fontSize: isPad ? 15 : 12,
                          color: colors.textSecondary,
                          marginTop: isPad ? 4 : 0,
                          fontFamily: 'Nunito-Regular'
                        }}>
                          {option.description}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </SafeAreaView>
        </RNAnimated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  safeArea: {
    flex: 1,
    minHeight: SCREEN_HEIGHT * 0.95,
  },
  contentWrapper: {
    flex: 1,
    maxWidth: isPad ? 720 : '100%',
    alignSelf: 'center',
    width: '100%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2.5,
  },
  closeButtonContainer: {
    alignItems: 'flex-end',
    paddingTop: 8,
    paddingRight: 16,
    paddingBottom: 8,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 4,
  },
  titleSubtext: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 32,
  },
  titleHighlight: {
    color: '#60A5FA',
    fontWeight: '600',
  },
  titleHighlight2: {
    color: '#34D399',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 24,
    gap: 12,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 24,
    gap: 12,
  },
  separatorLine: {
    flex: 1,
    height: 1,
  },
  separatorText: {
    fontSize: 14,
    fontWeight: '500',
  },
  optionsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  buttonIcon: {
    marginRight: 12,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
});
