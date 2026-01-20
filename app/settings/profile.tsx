import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { generateGradientFromString, getInitials, getAvatarUrl, AVATAR_STYLES, CURATED_LORELEI_SEEDS, CURATED_ADVENTURER_SEEDS } from '@/lib/utils/avatarGradient';
import { SvgUri } from 'react-native-svg';

export default function EditProfileScreen() {
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);
    const router = useRouter();
    const { user, authUser, setUser } = useStore();

    const [firstName, setFirstName] = useState(user.first_name || '');
    const [lastName, setLastName] = useState(user.last_name || '');
    const [avatarStyle, setAvatarStyle] = useState<'lorelei' | 'adventurer'>(user.avatar?.includes('/lorelei/') ? 'lorelei' : 'adventurer');
    const [avatarSeed, setAvatarSeed] = useState(user.avatar ? (user.avatar.split('seed=')[1]?.split('&')[0] || user.id) : authUser?.id || 'default');
    const [isSaving, setIsSaving] = useState(false);

    const avatarUrl = useMemo(() => {
        return getAvatarUrl(avatarSeed, avatarStyle);
    }, [avatarSeed, avatarStyle]);

    const handleSave = async () => {
        if (!firstName.trim()) {
            Alert.alert('Error', 'First name is required');
            return;
        }

        setIsSaving(true);
        try {
            if (authUser) {
                const { userService } = await import('@/lib/services/userService');
                const success = await userService.updateProfile(authUser.id, {
                    first_name: firstName,
                    last_name: lastName,
                    avatar: avatarUrl
                });

                if (success) {
                    setUser({ first_name: firstName, last_name: lastName, avatar: avatarUrl });
                    router.back();
                } else {
                    Alert.alert('Error', 'Failed to save changes');
                }
            }
        } catch (error) {
            console.error('Error saving profile:', error);
            Alert.alert('Error', 'Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    {/* Avatar Preview */}
                    <View style={styles.avatarSection}>
                        <View style={styles.avatarWrapper}>
                            <View style={[styles.avatarContainer, { backgroundColor: isDarkMode ? '#1c1c1e' : '#f2f2f7' }]}>
                                <SvgUri
                                    uri={avatarUrl}
                                    width="100%"
                                    height="100%"
                                />
                            </View>
                        </View>
                        <Text style={[styles.avatarHint, { color: colors.textSecondary }]}>Pick your character</Text>
                    </View>

                    {/* Curated Avatar Grid */}
                    <View style={styles.selectionSection}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Characters</Text>
                            <View style={styles.tabContainer}>
                                {AVATAR_STYLES.map((style) => (
                                    <TouchableOpacity
                                        key={style.id}
                                        onPress={() => setAvatarStyle(style.id as any)}
                                        style={[
                                            styles.tabButton,
                                            { borderBottomColor: avatarStyle === style.id ? colors.primary : 'transparent' }
                                        ]}
                                    >
                                        <Text style={[
                                            styles.tabText,
                                            {
                                                color: avatarStyle === style.id ? colors.primary : colors.textSecondary,
                                                fontFamily: avatarStyle === style.id ? 'Nunito-Bold' : 'Nunito-Medium'
                                            }
                                        ]}>
                                            {style.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.avatarGrid}>
                            {(avatarStyle === 'lorelei' ? CURATED_LORELEI_SEEDS : CURATED_ADVENTURER_SEEDS).map((seed) => (
                                <TouchableOpacity
                                    key={seed}
                                    onPress={() => setAvatarSeed(seed)}
                                    style={[
                                        styles.gridItem,
                                        {
                                            backgroundColor: isDarkMode ? '#1c1c1e' : '#f2f2f7',
                                            borderColor: avatarSeed === seed && avatarUrl.includes(`/${avatarStyle}/`) ? colors.primary : colors.border
                                        }
                                    ]}
                                >
                                    <SvgUri
                                        uri={getAvatarUrl(seed, avatarStyle)}
                                        width={60}
                                        height={60}
                                    />
                                    {avatarSeed === seed && avatarUrl.includes(`/${avatarStyle}/`) && (
                                        <View style={[styles.activeIndicator, { backgroundColor: colors.primary }]}>
                                            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>First Name</Text>
                            <TextInput
                                style={[styles.input, {
                                    backgroundColor: colors.surface,
                                    color: colors.text,
                                    borderColor: colors.border,
                                    fontFamily: 'Nunito-Medium'
                                }]}
                                value={firstName}
                                onChangeText={setFirstName}
                                placeholder="Enter first name"
                                placeholderTextColor={colors.textMuted}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Last Name</Text>
                            <TextInput
                                style={[styles.input, {
                                    backgroundColor: colors.surface,
                                    color: colors.text,
                                    borderColor: colors.border,
                                    fontFamily: 'Nunito-Medium'
                                }]}
                                value={lastName}
                                onChangeText={setLastName}
                                placeholder="Enter last name"
                                placeholderTextColor={colors.textMuted}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
                            <TextInput
                                style={[styles.input, {
                                    backgroundColor: isDarkMode ? '#2c2c2e' : '#f2f2f7',
                                    color: colors.textMuted,
                                    borderColor: colors.border,
                                    fontFamily: 'Nunito-Medium',
                                    opacity: 0.8
                                }]}
                                value={authUser?.email || ''}
                                editable={false}
                            />
                            <Text style={[styles.fieldHint, { color: colors.textMuted }]}>Email cannot be changed</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: colors.primary, opacity: isSaving ? 0.7 : 1 }]}
                            onPress={handleSave}
                            disabled={isSaving}
                        >
                            <Text style={styles.saveButtonText}>{isSaving ? 'SAVING...' : 'SAVE'}</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
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
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: 'Nunito-Bold',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 40,
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    avatarWrapper: {
        width: 140,
        height: 140,
        marginBottom: 8,
    },
    avatarContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 3,
        borderColor: '#9333ea',
    },
    avatarHint: {
        fontSize: 14,
        fontFamily: 'Nunito-Bold',
        marginTop: 12,
    },
    selectionSection: {
        marginBottom: 32,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    tabContainer: {
        flexDirection: 'row',
        gap: 16,
    },
    tabButton: {
        paddingVertical: 4,
        borderBottomWidth: 2,
    },
    tabText: {
        fontSize: 14,
    },
    avatarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'flex-start',
    },
    gridItem: {
        width: 76,
        height: 76,
        borderRadius: 38,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        position: 'relative',
    },
    activeIndicator: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    form: {
        gap: 24,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontFamily: 'Nunito-Bold',
        marginLeft: 4,
    },
    input: {
        height: 56,
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 16,
        fontSize: 16,
    },
    fieldHint: {
        fontSize: 12,
        fontFamily: 'Nunito-Regular',
        marginLeft: 4,
        marginTop: 2,
    },
    saveButton: {
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Nunito-Bold',
        letterSpacing: 1,
    },
});
