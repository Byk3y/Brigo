import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    Platform,
    Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
} from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';

const { width } = Dimensions.get('window');

interface StreakSaviorModalProps {
    visible: boolean;
    onClose: () => void;
    previousStreak: number;
    freezesLeft: number;
}

export function StreakSaviorModal({
    visible,
    onClose,
    previousStreak,
    freezesLeft,
}: StreakSaviorModalProps) {
    const { isDarkMode } = useTheme();
    const applyStreakFreeze = useStore((state) => state.applyStreakFreeze);
    const [isRestoring, setIsRestoring] = React.useState(false);

    const handleRestore = async () => {
        setIsRestoring(true);
        try {
            const result = await applyStreakFreeze();
            if (result.success) {
                // Success! Close modal.
                onClose();
            } else {
                Alert.alert('Error', result.error || 'Failed to apply streak freeze');
            }
        } catch (error) {
            console.error('Restore error:', error);
        } finally {
            setIsRestoring(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />

                <Animated.View
                    entering={FadeInDown.springify()}
                    style={styles.container}
                >
                    <LinearGradient
                        colors={isDarkMode ? ['#0C4A6E', '#082F49'] : ['#E0F2FE', '#BAE6FD']}
                        style={styles.card}
                    >
                        {/* Ice Shards / Background Decoration */}
                        <View style={styles.decorationContainer}>
                            <Ionicons name="snow" size={120} color="rgba(255,255,255,0.1)" style={styles.bgIcon} />
                        </View>

                        <Animated.View entering={FadeIn.delay(300)} style={styles.iconContainer}>
                            <View style={styles.shieldWrapper}>
                                <Ionicons name="shield-checkmark" size={64} color="#38BDF8" />
                                <View style={styles.streakBadge}>
                                    <Text style={styles.streakText}>{previousStreak}</Text>
                                </View>
                            </View>
                        </Animated.View>

                        <Animated.View entering={FadeInUp.delay(500)} style={styles.content}>
                            <Text style={[styles.title, { color: isDarkMode ? '#FFFFFF' : '#0369A1' }]}>
                                Streak Freeze!
                            </Text>
                            <Text style={[styles.description, { color: isDarkMode ? '#BAE6FD' : '#0C4A6E' }]}>
                                You missed a day, but your streak freeze saved you. Use it now to keep your {previousStreak}-day streak alive!
                            </Text>

                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    <Text style={[styles.statLabel, { color: isDarkMode ? '#7DD3FC' : '#0284C7' }]}>
                                        Freezes Left
                                    </Text>
                                    <View style={styles.restoreCountContainer}>
                                        <Ionicons name="snow" size={16} color="#38BDF8" />
                                        <Text style={[styles.statValue, { color: isDarkMode ? '#FFFFFF' : '#0C4A6E' }]}>
                                            {freezesLeft} / 3
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </Animated.View>

                        <View style={styles.footer}>
                            <TouchableOpacity
                                style={[styles.restoreButton, isRestoring && styles.buttonDisabled]}
                                onPress={handleRestore}
                                disabled={isRestoring || freezesLeft <= 0}
                            >
                                <LinearGradient
                                    colors={['#38BDF8', '#0284C7']}
                                    style={styles.buttonGradient}
                                >
                                    <Text style={styles.restoreButtonText}>
                                        {isRestoring ? 'Applying...' : 'Apply Freeze'}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.skipButton}
                                onPress={onClose}
                                disabled={isRestoring}
                            >
                                <Text style={[styles.skipButtonText, { color: isDarkMode ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                                    No thanks, start over
                                </Text>
                            </TouchableOpacity>
                        </View>
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
        borderRadius: 32,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    card: {
        padding: 32,
        alignItems: 'center',
    },
    decorationContainer: {
        position: 'absolute',
        top: -20,
        right: -20,
        opacity: 0.5,
    },
    bgIcon: {
        transform: [{ rotate: '15deg' }],
    },
    iconContainer: {
        marginBottom: 24,
    },
    shieldWrapper: {
        width: 120,
        height: 120,
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(56, 189, 248, 0.3)',
    },
    streakBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#EA580C',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#FFF',
    },
    streakText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    content: {
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        marginBottom: 12,
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        lineHeight: 24,
        textAlign: 'center',
        paddingHorizontal: 10,
    },
    statsRow: {
        marginTop: 24,
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 20,
    },
    statItem: {
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    restoreCountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
    },
    footer: {
        width: '100%',
        gap: 12,
    },
    restoreButton: {
        width: '100%',
        height: 56,
        borderRadius: 18,
        overflow: 'hidden',
    },
    buttonGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    restoreButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    skipButton: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    skipButtonText: {
        fontSize: 15,
        fontWeight: '600',
    },
});
