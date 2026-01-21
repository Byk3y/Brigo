import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Image, Dimensions, Text } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { getThemeColors } from '@/lib/ThemeContext';
import { TypewriterText } from '../components/TypewriterText';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { ResponsiveContainer } from '@/lib/components/ResponsiveContainer';

const { width, height } = Dimensions.get('window');

// Cap dimensions for tablet optimization
const MASCOT_SIZE = Math.min(width * 0.45, 180);
const MASCOT_GROUP_HEIGHT = Math.min(width * 0.55, 220);

// Words to cycle through
const ROTATING_WORDS = ['remember.', 'succeed.', 'excel.', 'master.'];

interface Screen1Props {
  colors: ReturnType<typeof getThemeColors>;
}

import BrigoSmug from '../../../assets/onboarding-ui/mascot/brigo_smug.png';

export function Screen1({ colors }: Screen1Props) {
  const [headlineComplete, setHeadlineComplete] = useState(false);
  const [speechComplete, setSpeechComplete] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);

  // Cycle through words every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWordIndex((prev) => (prev + 1) % ROTATING_WORDS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.screenContainer}>
      <ResponsiveContainer>
        {/* Top Section: Character + Speech Bubble */}
        <View style={styles.topSection}>
          {/* Mascot + Shadow Group */}
          <View style={styles.mascotGroup}>
            <MotiView
              animate={{
                scale: [0.8, 1.1, 0.8],
                opacity: [0.03, 0.08, 0.03]
              }}
              transition={{ loop: true, type: 'timing', duration: 3200 } as any}
              style={[styles.shadow, { backgroundColor: '#000' }]}
            />

            <MotiView
              from={{ opacity: 0, translateY: 30 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 500, delay: 300 } as any}
              style={styles.characterContainer}
            >
              <MotiView
                animate={{ translateY: [-8, 8, -8] }}
                transition={{ loop: true, type: 'timing', duration: 3000 } as any}
              >
                <Image
                  source={BrigoSmug}
                  style={styles.characterImage}
                  resizeMode="contain"
                />
              </MotiView>
            </MotiView>
          </View>

          {/* Speech Bubble - Brigo's Provocation */}
          <MotiView
            from={{ opacity: 0, scale: 0.9, translateY: 10 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 28, delay: 1000 } as any}
            style={[styles.bubbleContainer, { backgroundColor: colors.surfaceElevated }]}
          >
            <TypewriterText
              text="Reading alone won't help you remember."
              style={[styles.bubbleText, { color: colors.text }]}
              speed={35}
              delay={1500}
              onComplete={() => setSpeechComplete(true)}
            />
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: speechComplete ? 1 : 0 }}
              transition={{ type: 'timing', duration: 500 } as any}
            >
              <Text style={[styles.bubbleTextBold, { color: colors.primary }]}>Brigo makes sure you do.</Text>
            </MotiView>

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

        {/* Center Section: Core Headline */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 800, delay: 800 } as any}
          style={styles.headlineContainer}
        >
          <Text style={[styles.headline, { color: colors.text }]}>
            You deserve to
          </Text>
          <View style={styles.rotatingWordContainer}>
            <AnimatePresence exitBeforeEnter>
              <MotiView
                key={currentWordIndex}
                from={{ opacity: 0, translateY: 15 }}
                animate={{ opacity: 1, translateY: 0 }}
                exit={{ opacity: 0, translateY: -15 }}
                transition={{ type: 'timing', duration: 300 } as any}
              >
                <Text style={[styles.headline, { color: colors.primary }]}>
                  {ROTATING_WORDS[currentWordIndex]}
                </Text>
              </MotiView>
            </AnimatePresence>
          </View>
        </MotiView>

        {/* Bottom Section: Clinical Insight Card */}
        <MotiView
          from={{ opacity: 0, translateY: 40 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 600, delay: 1200 } as any}
          style={[
            styles.insightCard,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.primary + '20',
            },
          ]}
        >
          <View style={styles.insightContent}>
            <View style={styles.insightHeader}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="analytics-outline" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.insightLabel, { color: colors.primary }]}>THE PROBLEM</Text>
            </View>

            <Text style={[styles.body, { color: colors.textSecondary }]}>
              Most people forget <Text style={{ color: colors.text, fontWeight: '900', fontFamily: 'SpaceGrotesk-Bold' }}>80% of what they learn</Text>. That's hours of hard work—gone. Brigo uses proven science to make knowledge stick.
            </Text>
          </View>
        </MotiView>
      </ResponsiveContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
    paddingBottom: 40,
    paddingTop: height * 0.02,
  },
  topSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  mascotGroup: {
    alignItems: 'center',
    justifyContent: 'center',
    height: MASCOT_GROUP_HEIGHT,
    width: '100%',
    marginTop: -15,
  },
  characterContainer: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
    zIndex: 1,
  },
  characterImage: {
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
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 24,
    width: '100%',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -9,
    left: '50%',
    marginLeft: -8,
  },
  bubbleText: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk-Bold',
    lineHeight: 24,
    textAlign: 'center',
  },
  bubbleTextBold: {
    fontSize: 17,
    fontWeight: '900',
    fontFamily: 'SpaceGrotesk-Bold',
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 4,
  },
  headlineContainer: {
    marginVertical: 25,
    alignItems: 'center',
  },
  rotatingWordContainer: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headline: {
    fontSize: 34,
    fontWeight: '900',
    fontFamily: 'SpaceGrotesk-Bold',
    lineHeight: 42,
    textAlign: 'center',
    letterSpacing: -1.5,
  },
  insightCard: {
    padding: 24,
    borderRadius: 32,
    borderWidth: 1.5,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightContent: {
  },
  insightLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: 'SpaceGrotesk-Bold',
  },
  body: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk-Medium',
    lineHeight: 22,
  },
});
