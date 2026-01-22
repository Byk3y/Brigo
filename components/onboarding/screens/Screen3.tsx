import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert, Image, Dimensions } from 'react-native';
import { MotiView } from 'moti';
import { getThemeColors } from '@/lib/ThemeContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { APP_URLS } from '@/lib/constants';
import { useErrorHandler } from '@/lib/hooks/useErrorHandler';
import { useStore } from '@/lib/store';
import { TypewriterText } from '../components/TypewriterText';
import Svg, { Path } from 'react-native-svg';
import { track } from '@/lib/services/analyticsService';
import { ResponsiveContainer } from '@/lib/components/ResponsiveContainer';

const { width, height } = Dimensions.get('window');

// Cap dimensions for tablet optimization
const MASCOT_SIZE = Math.min(width * 0.4, 160);
const MASCOT_GROUP_HEIGHT = Math.min(width * 0.45, 180);

const FeatureItem = ({ icon, title, color, delay, isVisible, colors }: { icon: any, title: string, color: string, delay: number, isVisible: boolean, colors: any }) => (
  <MotiView
    from={{ opacity: 0, scale: 0.9, translateY: 10 }}
    animate={{
      opacity: isVisible ? 1 : 0,
      scale: isVisible ? 1 : 0.9,
      translateY: isVisible ? 0 : 10
    }}
    transition={{ type: 'spring', damping: 20, stiffness: 100, delay } as any}
    style={[styles.featureItem, { backgroundColor: color + '15', borderColor: color + '30' }]}
  >
    <View style={[styles.iconDot, { backgroundColor: color }]} />
    <Ionicons name={icon} size={16} color={color} />
    <Text style={[styles.featureText, { color: colors.text }]}>{title}</Text>
  </MotiView>
);

interface Screen3Props {
  colors: ReturnType<typeof getThemeColors>;
  onContinue: () => void;
}

import BrigoSmug from '../../../assets/onboarding-ui/mascot/brigo_smug.png';

export function Screen3({ colors, onContinue }: Screen3Props) {
  const router = useRouter();
  const { authUser, setCurrentOnboardingScreen } = useStore();
  const { handleError } = useErrorHandler();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [headlineComplete, setHeadlineComplete] = useState(false);

  const handleCreateAccount = () => {
    if (!termsAccepted) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Required', 'Please accept the Terms & Conditions and Privacy Policy to continue');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Track auth method
    track('onboarding_auth_method', {
      method: 'signup',
      already_authenticated: !!authUser,
    });

    if (authUser) {
      onContinue();
    } else {
      // Save progress to next screen BEFORE navigating to auth
      // This ensures user continues to pet naming after auth completes
      setCurrentOnboardingScreen(4);
      router.replace('/auth');
    }
  };

  const handleLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Track auth method
    track('onboarding_auth_method', {
      method: 'login',
      already_authenticated: !!authUser,
    });

    if (authUser) {
      onContinue();
    } else {
      // Save progress to next screen BEFORE navigating to auth
      setCurrentOnboardingScreen(4);
      router.replace('/auth');
    }
  };

  const handleTermsPress = () => {
    Linking.openURL(APP_URLS.TERMS).catch(async (err) => {
      await handleError(err, {
        operation: 'open_terms_link',
        component: 'onboarding-screen3',
        metadata: { url: APP_URLS.TERMS }
      });
    });
  };

  const handlePrivacyPress = () => {
    Linking.openURL(APP_URLS.PRIVACY).catch(async (err) => {
      await handleError(err, {
        operation: 'open_privacy_link',
        component: 'onboarding-screen3',
        metadata: { url: APP_URLS.PRIVACY }
      });
    });
  };

  const handleHeadlineComplete = React.useCallback(() => {
    setHeadlineComplete(true);
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
              style={styles.characterContainer}
            >
              <MotiView
                animate={{ translateY: [-6, 6, -6] }}
                transition={{ loop: true, type: 'timing', duration: 4000 } as any}
              >
                <Image
                  source={BrigoSmug}
                  style={styles.characterImage}
                  resizeMode="contain"
                />
              </MotiView>
            </MotiView>
          </View>

          <MotiView
            from={{ opacity: 0, scale: 0.9, translateY: 20 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 28, delay: 600 } as any}
            style={[styles.bubbleContainer, { backgroundColor: colors.surfaceElevated }]}
          >
            <TypewriterText
              text="Ready to study smarter? Let's set you up."
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

        {/* Hero Headline */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: headlineComplete ? 1 : 0, translateY: headlineComplete ? 0 : 10 }}
          style={styles.centerSection}
        >
          <Text style={[styles.mainHeading, { color: colors.text }]}>
            Create your <Text style={{ color: colors.primary }}>account</Text>
          </Text>
        </MotiView>

        {/* Feature Grid */}
        <View style={styles.featureGrid}>
          <FeatureItem
            icon="copy-outline"
            title="Flashcards"
            color="#F97316"
            delay={200}
            isVisible={headlineComplete}
            colors={colors}
          />
          <FeatureItem
            icon="list-outline"
            title="Quizzes"
            color="#3B82F6"
            delay={400}
            isVisible={headlineComplete}
            colors={colors}
          />
          <FeatureItem
            icon="chatbubbles-outline"
            title="Smart Chat"
            color="#10B981"
            delay={600}
            isVisible={headlineComplete}
            colors={colors}
          />
          <FeatureItem
            icon="headset-outline"
            title="Podcasts"
            color="#8B5CF6"
            delay={800}
            isVisible={headlineComplete}
            colors={colors}
          />
        </View>

        {/* Auth Section */}
        <View style={styles.authSection}>
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: headlineComplete ? 1 : 0, translateY: headlineComplete ? 0 : 20 }}
            transition={{ type: 'timing', duration: 600, delay: 1000 } as any}
          >
            {/* Terms Checkbox */}
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTermsAccepted(!termsAccepted);
              }}
              style={styles.termsContainer}
              activeOpacity={0.7}
            >
              <View style={[
                styles.checkbox,
                { borderColor: termsAccepted ? colors.primary : colors.border },
                termsAccepted && { backgroundColor: colors.primary }
              ]}>
                {termsAccepted && <Ionicons name="checkmark" size={12} color="white" />}
              </View>
              <Text style={[styles.termsText, { color: colors.textSecondary }]}>
                I agree to the{' '}
                <Text style={styles.linkText} onPress={handleTermsPress}>Terms</Text>
                {' & '}
                <Text style={styles.linkText} onPress={handlePrivacyPress}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>

            {/* Action Buttons */}
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                onPress={handleCreateAccount}
                style={[
                  styles.primaryButton,
                  { backgroundColor: termsAccepted ? colors.primary : colors.border }
                ]}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={18} color="white" style={{ marginLeft: 8 }} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleLogin}
                style={styles.secondaryButton}
                activeOpacity={0.7}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                  Already a member? <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign in</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </MotiView>
        </View>
      </ResponsiveContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
    paddingBottom: 20,
    paddingTop: height * 0.05,
  },
  topSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  mascotGroup: {
    alignItems: 'center',
    justifyContent: 'center',
    height: MASCOT_GROUP_HEIGHT,
    width: '100%',
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
    height: 10,
    borderRadius: 30,
    zIndex: 0,
  },
  bubbleContainer: {
    marginTop: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 20,
    width: '100%',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -11,
    left: '50%',
    marginLeft: -10,
  },
  headline: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk-Bold',
    lineHeight: 24,
    textAlign: 'center',
  },
  centerSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  mainHeading: {
    fontSize: 32,
    fontWeight: '900',
    fontFamily: 'SpaceGrotesk-Bold',
    textAlign: 'center',
    letterSpacing: -1.2,
    lineHeight: 40,
  },
  featureGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 30,
    flexWrap: 'wrap',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 8,
  },
  iconDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  featureText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk-Bold',
    letterSpacing: 0.2,
  },
  authSection: {
    marginTop: 'auto',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  termsText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk-Medium',
    lineHeight: 18,
    flex: 1,
  },
  linkText: {
    textDecorationLine: 'underline',
  },
  buttonGroup: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 17,
    fontFamily: 'SpaceGrotesk-Bold',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk-Medium',
  },
});

