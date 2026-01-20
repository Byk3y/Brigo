import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Modal, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { generateGradientFromString, getInitials, getAvatarUrl, CURATED_LORELEI_SEEDS, CURATED_ADVENTURER_SEEDS, AVATAR_STYLES } from '@/lib/utils/avatarGradient';
import { SvgUri } from 'react-native-svg';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);
    const router = useRouter();

    const {
        user,
        authUser,
        petState,
        notebooks,
        flashcardsStudied,
        loadUserProfile,
        loadNotebooks,
        loadPetState,
        setUser
    } = useStore();

    const [isPickerVisible, setIsPickerVisible] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [modalStyle, setModalStyle] = React.useState<'lorelei' | 'adventurer'>('adventurer');

    // Load fresh data on mount
    useEffect(() => {
        loadUserProfile();
        loadNotebooks();
        loadPetState();
    }, []);

    const initials = useMemo(() =>
        getInitials(user.first_name || '', user.last_name || '', authUser?.email || 'U'),
        [user.first_name, user.last_name, authUser?.email]);

    const avatarUrl = useMemo(() => {
        if (user.avatar) return user.avatar;
        const identifier = authUser?.id || authUser?.email || 'default';
        return getAvatarUrl(identifier);
    }, [user.avatar, authUser?.id, authUser?.email]);

    const joinedDate = useMemo(() => {
        if (!user.created_at) return 'Joined January 2025';
        const date = new Date(user.created_at);
        return `Joined ${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
    }, [user.created_at]);

    // Assessment/Preferences data
    const learningStyle = (user.meta as any)?.learning_style || 'Visual learner';
    const dailyGoal = (user.meta as any)?.daily_commitment_minutes || 15;

    // Detect current style when modal opens
    useEffect(() => {
        if (isPickerVisible && user.avatar) {
            if (user.avatar.includes('/adventurer/')) {
                setModalStyle('adventurer');
            } else {
                setModalStyle('lorelei');
            }
        }
    }, [isPickerVisible, user.avatar]);

    const handleAvatarSelect = async (seed: string) => {
        const newAvatarUrl = getAvatarUrl(seed, modalStyle);
        setIsSaving(true);
        try {
            if (authUser) {
                const { userService } = await import('@/lib/services/userService');
                const success = await userService.updateProfile(authUser.id, {
                    avatar: newAvatarUrl
                });

                if (success) {
                    setUser({ avatar: newAvatarUrl });
                    setIsPickerVisible(false);
                } else {
                    Alert.alert('Error', 'Failed to update avatar');
                }
            }
        } catch (error) {
            console.error('Error updating avatar:', error);
            Alert.alert('Error', 'An unexpected error occurred');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header with Name and Settings Gear */}
            <View style={styles.topHeader}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
                    <Ionicons name="chevron-back" size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.topName, { color: colors.text }]}>
                    {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.name}
                </Text>
                <TouchableOpacity onPress={() => router.push('/settings')} style={styles.iconButton}>
                    <Ionicons name="settings-outline" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Avatar Section */}
                <View style={styles.avatarContainer}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setIsPickerVisible(true)}
                        style={styles.avatarWrapper}
                    >
                        <View style={[styles.avatarContainerStyle, { backgroundColor: isDarkMode ? '#1c1c1e' : '#f2f2f7' }]}>
                            <SvgUri
                                uri={avatarUrl}
                                width="100%"
                                height="100%"
                            />
                        </View>
                        <View style={[
                            styles.badgeContainer,
                            {
                                backgroundColor: isDarkMode ? '#4a4a4c' : '#FFFFFF',
                                borderColor: isDarkMode ? '#606062' : '#E5E7EB',
                                borderWidth: 1
                            }
                        ]}>
                            <Ionicons name="camera" size={16} color={colors.textSecondary} />
                        </View>
                    </TouchableOpacity>
                    <Text style={[styles.joinedText, { color: colors.textMuted }]}>{joinedDate}</Text>
                </View>

                {/* Stats Row */}
                <View style={[styles.statsRow, { borderColor: colors.borderLight }]}>
                    <View style={styles.statItem}>
                        <View style={styles.fireIconWrapper}>
                            <Ionicons name="flame" size={24} color="#FF5F06" />
                        </View>
                        <Text style={[styles.statValue, { color: colors.text }]}>{user.streak || 0}</Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Streak</Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
                    <View style={styles.statItem}>
                        <Text style={styles.statEmoji}>📚</Text>
                        <Text style={[styles.statValue, { color: colors.text }]}>{notebooks.length}</Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Books</Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
                    <View style={styles.statItem}>
                        <Text style={styles.statEmoji}>⭐</Text>
                        <Text style={[styles.statValue, { color: colors.text }]}>{petState.points || 0}</Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Points</Text>
                    </View>
                </View>

                {/* Pet Section */}
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                        <View style={styles.petHeaderRow}>
                            <Ionicons name="paw" size={18} color={isDarkMode ? colors.primaryLight : colors.primary} />
                            <Text style={[styles.petHeaderTitle, { color: colors.text }]}>{petState.name.toUpperCase()}</Text>
                        </View>
                    </View>
                    <View style={styles.petContent}>
                        <View style={styles.petInfo}>
                            <Text style={[styles.petName, { color: colors.text }]}>Level {petState.stage}</Text>
                            <Text style={[styles.petPoints, { color: colors.textSecondary }]}>{petState.points % 100}% towards next stage</Text>
                        </View>
                        <View style={[styles.progressBarBg, { backgroundColor: isDarkMode ? '#404040' : '#E5E7EB' }]}>
                            <LinearGradient
                                colors={[colors.primary, colors.primaryLight]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[styles.progressBarFill, { width: `${petState.points % 100}%` }]}
                            />
                        </View>
                    </View>
                </View>

                {/* Overview Section */}
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                        <Text style={[styles.cardTitle, { color: colors.text }]}>OVERVIEW</Text>
                    </View>
                    <View style={styles.overviewList}>
                        <View style={styles.overviewItem}>
                            <Ionicons name="flame" size={20} color="#FF5F06" style={{ width: 24, textAlign: 'center' }} />
                            <Text style={[styles.overviewText, { color: colors.text }]}>{user.streak || 0} day streak</Text>
                        </View>
                        <View style={styles.overviewItem}>
                            <Ionicons name="book" size={18} color="#3B82F6" style={{ width: 24, textAlign: 'center' }} />
                            <Text style={[styles.overviewText, { color: colors.text }]}>{notebooks.length} notebooks created</Text>
                        </View>
                        <View style={styles.overviewItem}>
                            <Ionicons name="layers" size={18} color="#EF4444" style={{ width: 24, textAlign: 'center' }} />
                            <Text style={[styles.overviewText, { color: colors.text }]}>{flashcardsStudied || 0} flashcards studied</Text>
                        </View>
                        <View style={styles.overviewItem}>
                            <Ionicons name="school" size={18} color="#A855F7" style={{ width: 24, textAlign: 'center' }} />
                            <Text style={[styles.overviewText, { color: colors.text }]}>{learningStyle.charAt(0).toUpperCase() + learningStyle.slice(1)}</Text>
                        </View>
                        <View style={styles.overviewItem}>
                            <Ionicons name="timer" size={18} color="#06B6D4" style={{ width: 24, textAlign: 'center' }} />
                            <Text style={[styles.overviewText, { color: colors.text }]}>{dailyGoal} min daily goal</Text>
                        </View>
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Avatar Picker Modal */}
            <Modal
                visible={isPickerVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsPickerVisible(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => !isSaving && setIsPickerVisible(false)}
                >
                    <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>Choose Character</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setIsPickerVisible(false)}
                                disabled={isSaving}
                            >
                                <Ionicons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Style Selector Tabs */}
                        <View style={styles.tabContainer}>
                            {AVATAR_STYLES.map((style) => (
                                <TouchableOpacity
                                    key={style.id}
                                    onPress={() => setModalStyle(style.id as any)}
                                    style={[
                                        styles.tabButton,
                                        { borderBottomColor: modalStyle === style.id ? colors.primary : 'transparent' }
                                    ]}
                                >
                                    <Text style={[
                                        styles.tabText,
                                        {
                                            color: modalStyle === style.id ? colors.primary : colors.textSecondary,
                                            fontFamily: modalStyle === style.id ? 'Nunito-Bold' : 'Nunito-Medium'
                                        }
                                    ]}>
                                        {style.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.gridContainer}
                        >
                            {(modalStyle === 'lorelei' ? CURATED_LORELEI_SEEDS : CURATED_ADVENTURER_SEEDS).map((seed) => {
                                const currentUrl = getAvatarUrl(seed, modalStyle);
                                const isSelected = user.avatar === currentUrl;

                                return (
                                    <TouchableOpacity
                                        key={seed}
                                        onPress={() => handleAvatarSelect(seed)}
                                        disabled={isSaving}
                                        style={[
                                            styles.gridItem,
                                            {
                                                backgroundColor: isDarkMode ? '#2c2c2e' : '#f2f2f7',
                                                borderColor: isSelected ? colors.primary : 'transparent'
                                            }
                                        ]}
                                    >
                                        <SvgUri
                                            uri={currentUrl}
                                            width={80}
                                            height={80}
                                        />
                                        {isSelected && (
                                            <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                                                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {isSaving && (
                            <View style={styles.savingOverlay}>
                                <ActivityIndicator size="large" color={colors.primary} />
                            </View>
                        )}
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    topHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    iconButton: {
        padding: 4,
    },
    topName: {
        fontSize: 20,
        fontFamily: 'Nunito-Bold',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    avatarWrapper: {
        width: 120,
        height: 120,
        position: 'relative',
        marginBottom: 16,
    },
    avatarContainerStyle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#9333ea',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 6,
    },
    badgeContainer: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    badgeEmoji: {
        fontSize: 20,
    },
    joinedText: {
        fontSize: 14,
        fontFamily: 'Nunito-Medium',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: 20,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        marginBottom: 24,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statEmoji: {
        fontSize: 20,
        marginBottom: 4,
    },
    fireIconWrapper: {
        marginBottom: 4,
        shadowColor: '#FF5F06',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 4,
    },
    statValue: {
        fontSize: 22,
        fontFamily: 'Nunito-Bold',
    },
    statLabel: {
        fontSize: 12,
        fontFamily: 'Nunito-Medium',
    },
    statDivider: {
        width: 1,
        height: 40,
    },
    card: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardHeader: {
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 12,
        fontFamily: 'Nunito-Bold',
        letterSpacing: 1.2,
    },
    petHeaderTitle: {
        fontSize: 18,
        fontFamily: 'Nunito-Bold',
        letterSpacing: 0.5,
    },
    petHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    petContent: {
        gap: 12,
    },
    petInfo: {
        gap: 4,
    },
    petName: {
        fontSize: 18,
        fontFamily: 'Nunito-Bold',
    },
    petPoints: {
        fontSize: 14,
        fontFamily: 'Nunito-Medium',
    },
    progressBarBg: {
        height: 12,
        borderRadius: 6,
        width: '100%',
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 6,
    },
    overviewList: {
        gap: 12,
    },
    overviewItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    overviewEmoji: {
        fontSize: 18,
        width: 24,
        textAlign: 'center',
    },
    overviewText: {
        fontSize: 16,
        fontFamily: 'Nunito-Medium',
    },
    soonText: {
        fontSize: 15,
        fontFamily: 'Nunito-Medium',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        maxHeight: '80%',
        paddingBottom: 40,
        position: 'relative',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontFamily: 'Nunito-Bold',
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        marginBottom: 16,
        gap: 24,
    },
    tabButton: {
        paddingVertical: 8,
        borderBottomWidth: 2,
    },
    tabText: {
        fontSize: 15,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        paddingHorizontal: 20,
        justifyContent: 'center',
    },
    gridItem: {
        width: width / 3 - 22,
        height: width / 3 - 22,
        borderRadius: (width / 3 - 22) / 2,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        position: 'relative',
    },
    checkBadge: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    savingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
    }
});
