import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, TouchableOpacity } from 'react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { getThemeColors } from '@/lib/ThemeContext';
import { TypewriterText } from '../components/TypewriterText';
import Svg, { Path } from 'react-native-svg';
import { notificationService } from '@/lib/services/notificationService';
import { useStore } from '@/lib/store';
import { track } from '@/lib/services/analyticsService';
import { ResponsiveContainer } from '@/lib/components/ResponsiveContainer';

const { width, height } = Dimensions.get('window');

// Cap dimensions for tablet optimization
const MASCOT_SIZE = Math.min(width * 0.4, 160);
const MASCOT_GROUP_HEIGHT = Math.min(width * 0.45, 180);

import BrigoAnalytical from '../../../assets/onboarding-ui/mascot/brigo_analytical.png';

interface Screen4NotificationsProps {
    colors: ReturnType<typeof getThemeColors>;
    petName: string;
    onDone: () => void;
}

export function Screen4_Notifications({ colors, petName, onDone }: Screen4NotificationsProps) {
    const [headlineComplete, setHeadlineComplete] = useState(false);
    const [isRequesting, setIsRequesting] = useState(false);
    const authUser = useStore((state) => state.authUser);
    const nameToUse = petName || 'Brigo';

    const handleHeadlineComplete = useCallback(() => {
        setHeadlineComplete(true);
    }, []);

    const handleEnable = async () => {
        setIsRequesting(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const token = await notificationService.registerForPushNotificationsAsync(true);
            if (token && authUser?.id) {
                await notificationService.saveTokenToProfile(authUser.id, token);
            }

            // Track notification enabled
            track('onboarding_notifications', {
                enabled: !!token,
                action: 'enabled',
            });
        } catch (error) {
            console.error('Failed to enable notifications:', error);
            track('onboarding_notifications', {
                enabled: false,
                action: 'error',
            });
        } finally {
            setIsRequesting(false);
            onDone();
        }
    };

    return (
        <View style={styles.container}>
            <ResponsiveContainer>
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
                                    source={BrigoAnalytical}
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
                            text={`Can I send you gentle reminders? I'll help you stay on track!`}
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

                <MotiView
                    from={{ opacity: 0, translateY: 20 }}
                    animate={{ opacity: headlineComplete ? 1 : 0, translateY: headlineComplete ? 0 : 20 }}
                    transition={{ type: 'timing', duration: 600, delay: 200 } as any}
                    style={styles.actionSection}
                >
                    <TouchableOpacity
                        onPress={handleEnable}
                        disabled={isRequesting}
                        activeOpacity={0.8}
                        style={[styles.enableButton, { backgroundColor: colors.primary }]}
                    >
                        <Text style={styles.enableButtonText}>
                            {isRequesting ? 'Enabling...' : 'Turn on notifications'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={onDone}
                        disabled={isRequesting}
                        activeOpacity={0.7}
                        style={styles.skipButton}
                    >
                        <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>
                            Maybe later
                        </Text>
                    </TouchableOpacity>

                    <View style={[styles.infoCard, { backgroundColor: colors.primary + '05', borderColor: colors.primary + '20' }]}>
                        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                            I'll only send helpful study reminders & streak alerts. No spam, promise!
                        </Text>
                    </View>
                </MotiView>
            </ResponsiveContainer>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
    },
    topSection: {
        alignItems: 'center',
        marginBottom: 40,
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
        fontSize: 17,
        fontWeight: '800',
        fontFamily: 'SpaceGrotesk-Bold',
        lineHeight: 24,
        textAlign: 'center',
    },
    actionSection: {
        width: '100%',
        alignItems: 'center',
    },
    enableButton: {
        width: '100%',
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    enableButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        fontFamily: 'SpaceGrotesk-Bold',
        letterSpacing: 2,
    },
    skipButton: {
        paddingVertical: 12,
        marginBottom: 32,
    },
    skipButtonText: {
        fontSize: 14,
        fontFamily: 'SpaceGrotesk-Bold',
        opacity: 0.6,
        fontWeight: '700',
    },
    infoCard: {
        padding: 24,
        borderRadius: 28,
        borderWidth: 1.5,
        width: '100%',
    },
    infoText: {
        fontSize: 13,
        fontFamily: 'SpaceGrotesk-Medium',
        lineHeight: 18,
        textAlign: 'center',
    },
});
