import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, Dimensions, Text } from 'react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { getThemeColors } from '@/lib/ThemeContext';
import { TypewriterText } from '../components/TypewriterText';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { ResponsiveContainer } from '@/lib/components/ResponsiveContainer';

const { width, height } = Dimensions.get('window');

// Cap dimensions for tablet optimization
const MASCOT_SIZE = Math.min(width * 0.45, 180);
const MASCOT_GROUP_HEIGHT = Math.min(width * 0.5, 200);

interface Screen2Props {
  colors: ReturnType<typeof getThemeColors>;
}

import BrigoAnalytical from '../../../assets/onboarding-ui/mascot/brigo_analytical.png';

export function Screen2({ colors }: Screen2Props) {
  const [headlineComplete, setHeadlineComplete] = useState(false);

  useEffect(() => {
    if (headlineComplete) {
      // Sync haptics with gauge bar animations
      const t1 = setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 1000);

      const t2 = setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }, 1200);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [headlineComplete]);

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
                  source={BrigoAnalytical}
                  style={styles.characterImage}
                  resizeMode="contain"
                />
              </MotiView>
            </MotiView>
          </View>

          {/* Speech Bubble */}
          <MotiView
            from={{ opacity: 0, scale: 0.9, translateY: 20 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 28, delay: 800 } as any}
            style={[styles.bubbleContainer, { backgroundColor: colors.surfaceElevated }]}
          >
            <TypewriterText
              text="This is why your brain forgets."
              style={[styles.headline, { color: colors.text }]}
              speed={40}
              delay={1200}
              onComplete={() => setHeadlineComplete(true)}
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

        {/* Center Section: Clinical Comparison */}
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: headlineComplete ? 1 : 0, scale: headlineComplete ? 1 : 0.95 }}
          transition={{ type: 'timing', duration: 600 } as any}
          style={[styles.comparisonContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.primary + '15' }]}
        >
          <Text style={[styles.comparisonTitle, { color: colors.textSecondary }]}>WHAT YOU REMEMBER AFTER 2 DAYS</Text>

          <View style={styles.comparisonRow}>
            <View style={styles.barLabelContainer}>
              <Text style={[styles.barLabel, { color: colors.textSecondary }]}>Just reading</Text>
              <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                <MotiView
                  from={{ width: '0%' }}
                  animate={{ width: headlineComplete ? '20%' : '0%' }}
                  transition={{ type: 'timing', duration: 1200, delay: 1000 } as any}
                  style={[styles.barFill, { backgroundColor: colors.textMuted }]}
                />
              </View>
            </View>
            <Text style={[styles.percentageText, { color: colors.textMuted }]}>20%</Text>
          </View>

          <View style={styles.comparisonRow}>
            <View style={styles.barLabelContainer}>
              <Text style={[styles.barLabel, { color: colors.primary, fontWeight: '800' }]}>With Brigo</Text>
              <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                <MotiView
                  from={{ width: '0%' }}
                  animate={{ width: headlineComplete ? '90%' : '0%' }}
                  transition={{ type: 'spring', damping: 12, stiffness: 80, delay: 1200 } as any}
                  style={[styles.barFill, { backgroundColor: colors.primary }]}
                />
              </View>
            </View>
            <Text style={[styles.percentageText, { color: colors.primary, fontWeight: '800' }]}>90%</Text>
          </View>
        </MotiView>

        {/* Bottom Section: Science Insight Card */}
        <MotiView
          from={{ opacity: 0, translateY: 30 }}
          animate={{ opacity: headlineComplete ? 1 : 0, translateY: headlineComplete ? 0 : 30 }}
          transition={{ type: 'timing', duration: 500, delay: 2000 } as any}
          style={[
            styles.insightCard,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.primary + '10',
            },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="flash" size={18} color={colors.primary} />
          </View>
          <View style={styles.insightContent}>
            <Text style={[styles.insightLabel, { color: colors.primary }]}>THE SCIENCE</Text>
            <TypewriterText
              text="There's a way to flip this. A method that makes your brain hold onto information instead of letting it slip away. That's what Brigo does."
              style={[styles.body, { color: colors.textSecondary }]}
              speed={25}
              startTrigger={headlineComplete}
              delay={2200}
            />
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
    justifyContent: 'space-between',
    paddingBottom: 40,
    paddingTop: height * 0.05,
  },
  topSection: {
    alignItems: 'center',
    marginBottom: 25,
  },
  mascotGroup: {
    alignItems: 'center',
    justifyContent: 'center',
    height: MASCOT_GROUP_HEIGHT,
    width: '100%',
    marginTop: -20,
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
    bottom: 20,
    width: 60,
    height: 12,
    borderRadius: 30,
    zIndex: 0,
  },
  bubbleContainer: {
    marginTop: 10,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 24,
    width: '100%',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
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
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'SpaceGrotesk-Bold',
    lineHeight: 26,
    textAlign: 'center',
  },
  comparisonTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
    fontFamily: 'SpaceGrotesk-Bold',
    textAlign: 'center',
    opacity: 0.6,
  },
  comparisonContainer: {
    padding: 24,
    borderRadius: 32,
    borderWidth: 1.5,
    gap: 20,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  barLabelContainer: {
    flex: 1,
    gap: 8,
  },
  barLabel: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk-SemiBold',
  },
  barTrack: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  percentageText: {
    fontSize: 20,
    fontFamily: 'SpaceGrotesk-Bold',
    width: 45,
    textAlign: 'right',
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightContent: {
    flex: 1,
  },
  insightLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 4,
    fontFamily: 'SpaceGrotesk-Bold',
  },
  body: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk-Medium',
    lineHeight: 22,
  },
});

