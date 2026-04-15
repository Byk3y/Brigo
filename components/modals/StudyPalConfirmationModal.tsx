import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { BrigoAvatar } from '@/components/BrigoAvatar';

export function StudyPalConfirmationModal() {
    const { isDarkMode } = useTheme();
    const pal = useStore((s) => s.justAcceptedPal);
    const setJustAcceptedPal = useStore((s) => s.setJustAcceptedPal);
    const userAvatar = useStore((s) => s.user?.avatar);
    const userId = useStore((s) => s.user?.id);

    useEffect(() => {
        if (pal) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
    }, [pal]);

    if (!pal) return null;

    const palName = pal.first_name || pal.name || 'your study pal';
    const userIdentifier = userAvatar || userId;
    const palIdentifier = pal.avatar_url || pal.id;

    const dismiss = () => setJustAcceptedPal(null);

    return (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
            <View style={styles.overlay}>
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />

                <Animated.View entering={FadeInDown.springify()} style={styles.container}>
                    <LinearGradient
                        colors={isDarkMode ? ['#3B1F5B', '#1F1033'] : ['#FFE7D1', '#FFF3E2']}
                        style={styles.card}
                    >
                        <Animated.View entering={FadeIn.delay(150)} style={styles.avatarsRow}>
                            <View style={styles.avatarRing}>
                                <BrigoAvatar identifier={userIdentifier} size={72} />
                            </View>
                            <View style={styles.linkBadge}>
                                <Ionicons name="sparkles" size={18} color="#FF5F06" />
                            </View>
                            <View style={[styles.avatarRing, { marginLeft: -14 }]}>
                                <BrigoAvatar identifier={palIdentifier} size={72} />
                            </View>
                        </Animated.View>

                        <Animated.View entering={FadeInUp.delay(300)} style={styles.content}>
                            <Text style={[styles.title, { color: isDarkMode ? '#FFFFFF' : '#1F1033' }]}>
                                You're now study pals!
                            </Text>
                            <Text style={[styles.description, { color: isDarkMode ? 'rgba(255,255,255,0.75)' : '#5B4B6B' }]}>
                                Study every day to keep each other's streaks alive with {palName}.
                            </Text>
                        </Animated.View>

                        <TouchableOpacity style={styles.primaryButton} onPress={dismiss}>
                            <LinearGradient
                                colors={['#FF7A29', '#FF5F06']}
                                style={styles.buttonGradient}
                            >
                                <Text style={styles.primaryButtonText}>Got it</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </LinearGradient>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    container: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 28,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
            },
            android: { elevation: 10 },
        }),
    },
    card: {
        padding: 28,
        alignItems: 'center',
    },
    avatarsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    avatarRing: {
        width: 76,
        height: 76,
        borderRadius: 38,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.6)',
        padding: 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    linkBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: -12,
        zIndex: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    content: {
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontFamily: 'Outfit-Bold',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    description: {
        fontSize: 15,
        lineHeight: 22,
        fontFamily: 'Outfit-Regular',
        textAlign: 'center',
        paddingHorizontal: 8,
    },
    primaryButton: {
        width: '100%',
        height: 52,
        borderRadius: 16,
        overflow: 'hidden',
    },
    buttonGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontFamily: 'Outfit-Bold',
        letterSpacing: 0.2,
    },
});
