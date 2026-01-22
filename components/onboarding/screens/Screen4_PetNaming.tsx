import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Dimensions, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { getThemeColors } from '@/lib/ThemeContext';
import { TypewriterText } from '../components/TypewriterText';
import Svg, { Path } from 'react-native-svg';
import { ResponsiveContainer } from '@/lib/components/ResponsiveContainer';

const { width, height } = Dimensions.get('window');

// Cap dimensions for tablet optimization
const MASCOT_SIZE = Math.min(width * 0.3, 120);
const MASCOT_GROUP_HEIGHT = Math.min(width * 0.35, 140);

// Use Stage 1 pet for first-time introduction
const PetStage1 = require('../../../assets/pets/stage-1/full-view.png');

interface Screen4PetNamingProps {
  petName: string;
  onNameChange: (name: string) => void;
  colors: ReturnType<typeof getThemeColors>;
}

export function Screen4_PetNaming({ petName, onNameChange, colors }: Screen4PetNamingProps) {
  const [headlineComplete, setHeadlineComplete] = useState(false);
  const suggestions = ['Brigo', 'Buddy', 'Nova', 'Selar'];

  const handleHeadlineComplete = useCallback(() => {
    setHeadlineComplete(true);
  }, []);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <ResponsiveContainer>
          {/* Top Section: Mascot + Speech Bubble */}
          <View style={styles.topSection}>
            {/* Mascot + Shadow Group */}
            <View style={styles.mascotGroup}>
              <MotiView
                animate={{
                  scale: [0.8, 1.05, 0.8],
                  opacity: [0.03, 0.08, 0.03]
                }}
                transition={{ loop: true, type: 'timing', duration: 3200 } as any}
                style={[styles.shadow, { backgroundColor: '#000' }]}
              />
              <MotiView
                from={{ opacity: 0, scale: 0.5, translateY: 20 }}
                animate={{ opacity: 1, scale: 1, translateY: 0 }}
                transition={{ type: 'spring', damping: 15, delay: 300 } as any}
                style={styles.petContainer}
              >
                <MotiView
                  animate={{ translateY: [-8, 8, -8] }}
                  transition={{ loop: true, type: 'timing', duration: 3000 } as any}
                >
                  <Image
                    source={PetStage1}
                    style={styles.petImage}
                    resizeMode="contain"
                  />
                </MotiView>
              </MotiView>
            </View>

            <MotiView
              from={{ opacity: 0, scale: 0.9, translateY: 10 }}
              animate={{ opacity: 1, scale: 1, translateY: 0 }}
              transition={{ type: 'spring', damping: 28, delay: 600 } as any}
              style={[styles.bubbleContainer, { backgroundColor: colors.surfaceElevated }]}
            >
              <TypewriterText
                text="Every learner needs a study buddy! What's my name?"
                style={[styles.headline, { color: colors.text }]}
                speed={40}
                delay={1000}
                onComplete={handleHeadlineComplete}
              />
              <View style={styles.bubbleTail}>
                <Svg width="20" height="12" viewBox="0 0 20 12">
                  <Path
                    d="M10 12C10 12 7.5 4 0 0L20 0C12.5 4 10 12 10 12Z"
                    fill={colors.surfaceElevated}
                  />
                </Svg>
              </View>
            </MotiView>
          </View>

          {/* Input Section */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: headlineComplete ? 1 : 0, translateY: headlineComplete ? 0 : 20 }}
            transition={{ type: 'timing', duration: 600, delay: 200 } as any}
            style={styles.inputSection}
          >
            <TextInput
              value={petName}
              onChangeText={onNameChange}
              placeholder="Give me a name..."
              placeholderTextColor={colors.textSecondary + '60'}
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.surfaceElevated,
                  borderColor: petName.trim() ? colors.primary : colors.border + '40',
                }
              ]}
              maxLength={15}
              autoCapitalize="words"
              autoCorrect={false}
            />

            {/* Suggestions */}
            <View style={styles.suggestionsContainer}>
              <Text style={[styles.suggestionTitle, { color: colors.primary }]}>OR PICK ONE</Text>
              <View style={styles.suggestionsGrid}>
                {suggestions.map((name) => {
                  const isSelected = petName === name;
                  return (
                    <TouchableOpacity
                      key={name}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onNameChange(name);
                      }}
                      activeOpacity={0.7}
                      style={[
                        styles.suggestionChip,
                        {
                          backgroundColor: isSelected ? colors.primary + '08' : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border + '40',
                        }
                      ]}
                    >
                      <Text style={[
                        styles.suggestionText,
                        { color: isSelected ? colors.primary : colors.textSecondary }
                      ]}>
                        {name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Explainer / Motivation */}
            <View style={[styles.infoCard, { backgroundColor: colors.primary + '05', borderColor: colors.primary + '20' }]}>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                I'll grow stronger as you learn! Take care of me, and I'll help you study smarter.
              </Text>
            </View>
          </MotiView>
        </ResponsiveContainer>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 24,
  },
  topSection: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 16,
  },
  mascotGroup: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: MASCOT_GROUP_HEIGHT,
  },
  petContainer: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
    zIndex: 1,
  },
  petImage: {
    width: '100%',
    height: '100%',
  },
  shadow: {
    position: 'absolute',
    bottom: 25,
    width: 60,
    height: 10,
    borderRadius: 30,
    zIndex: 0,
  },
  bubbleContainer: {
    marginTop: 5,
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 24,
    width: '100%',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -11,
    left: '50%',
    marginLeft: -10,
  },
  headline: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'SpaceGrotesk-Bold',
    lineHeight: 24,
    textAlign: 'center',
  },
  inputSection: {
    width: '100%',
  },
  input: {
    height: 76,
    borderRadius: 28,
    paddingHorizontal: 24,
    fontSize: 24,
    fontFamily: 'SpaceGrotesk-Bold',
    textAlign: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 16,
  },
  suggestionsContainer: {
    marginBottom: 16,
  },
  suggestionTitle: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk-Bold',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 2,
    fontWeight: '900',
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    gap: 10,
  },
  suggestionChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  suggestionText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk-Bold',
  },
  infoCard: {
    padding: 24,
    borderRadius: 28,
    borderWidth: 1.5,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk-Medium',
    lineHeight: 20,
    textAlign: 'center',
  },
});
