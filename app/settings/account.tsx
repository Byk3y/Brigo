import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { notificationService } from '@/lib/services/notificationService';

export default function AccountManagementScreen() {
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);
    const router = useRouter();
    const { authUser, resetPetState } = useStore();
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [confirmationText, setConfirmationText] = useState('');

    const handleInitiateDelete = () => {
        setShowDeleteConfirmation(true);
    };

    const handleConfirmDelete = async () => {
        if (confirmationText.toUpperCase() !== 'DELETE') {
            Alert.alert('Invalid Input', 'Please type DELETE to confirm');
            return;
        }

        Alert.alert(
            "Final Confirmation",
            "This will permanently delete your account, study materials, and pet progress. This action cannot be undone.\n\nAre you absolutely sure?",
            [
                {
                    text: "Cancel",
                    style: "cancel",
                    onPress: () => {
                        setShowDeleteConfirmation(false);
                        setConfirmationText('');
                    }
                },
                {
                    text: "Delete Permanently",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            // Clear push token before deletion
                            if (authUser?.id) {
                                await notificationService.clearTokenFromProfile(authUser.id);
                            }
                            const { data, error } = await supabase.functions.invoke('delete-user');
                            if (error) throw error;

                            Alert.alert("Account Deleted", "Your account has been successfully removed.");
                            resetPetState();
                            await supabase.auth.signOut();
                            router.replace('/auth');
                        } catch (error) {
                            console.error('Error deleting account:', error);
                            Alert.alert("Error", "Failed to delete account. Please contact support@brigo.app");
                        } finally {
                            setShowDeleteConfirmation(false);
                            setConfirmationText('');
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Account Management</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Account Info */}
                <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.infoRow}>
                        <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
                        <Text style={[styles.infoText, { color: colors.text }]}>{authUser?.email}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                        <Text style={[styles.infoText, { color: colors.textMuted }]}>
                            Joined {authUser?.created_at ? new Date(authUser.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently'}
                        </Text>
                    </View>
                </View>

                {/* Warning Section */}
                <View style={[styles.warningCard, { backgroundColor: isDarkMode ? '#2c1810' : '#FFF5F5', borderColor: '#FF6B6B' }]}>
                    <View style={styles.warningHeader}>
                        <Ionicons name="warning" size={24} color="#FF6B6B" />
                        <Text style={[styles.warningTitle, { color: isDarkMode ? '#FFB4B4' : '#C92A2A' }]}>Danger Zone</Text>
                    </View>
                    <Text style={[styles.warningText, { color: isDarkMode ? '#E8A9A9' : '#C92A2A' }]}>
                        Deleting your account is permanent and cannot be undone. All your data will be lost forever.
                    </Text>
                </View>

                {!showDeleteConfirmation ? (
                    // Initial Delete Button
                    <TouchableOpacity
                        style={[styles.deleteButton, { borderColor: '#FF3B30' }]}
                        onPress={handleInitiateDelete}
                    >
                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                        <Text style={styles.deleteButtonText}>Delete My Account</Text>
                    </TouchableOpacity>
                ) : (
                    // Confirmation Section
                    <View style={[styles.confirmationCard, { backgroundColor: colors.surface, borderColor: '#FF3B30' }]}>
                        <Text style={[styles.confirmationTitle, { color: colors.text }]}>Type DELETE to confirm</Text>
                        <Text style={[styles.confirmationSubtext, { color: colors.textMuted }]}>
                            This will permanently delete:
                        </Text>
                        <View style={styles.deleteList}>
                            <Text style={[styles.deleteListItem, { color: colors.textSecondary }]}>• All your notebooks and study materials</Text>
                            <Text style={[styles.deleteListItem, { color: colors.textSecondary }]}>• Your pet and all progress</Text>
                            <Text style={[styles.deleteListItem, { color: colors.textSecondary }]}>• Your account and subscription</Text>
                            <Text style={[styles.deleteListItem, { color: colors.textSecondary }]}>• All app data and settings</Text>
                        </View>

                        <TextInput
                            style={[styles.confirmInput, {
                                backgroundColor: isDarkMode ? '#2c2c2e' : '#f2f2f7',
                                color: colors.text,
                                borderColor: confirmationText.toUpperCase() === 'DELETE' ? '#FF3B30' : colors.border,
                                fontFamily: 'Nunito-Bold'
                            }]}
                            value={confirmationText}
                            onChangeText={setConfirmationText}
                            placeholder="Type DELETE"
                            placeholderTextColor={colors.textMuted}
                            autoCapitalize="characters"
                            autoCorrect={false}
                        />

                        <View style={styles.confirmButtonsRow}>
                            <TouchableOpacity
                                style={[styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                onPress={() => {
                                    setShowDeleteConfirmation(false);
                                    setConfirmationText('');
                                }}
                            >
                                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.confirmDeleteButton, {
                                    backgroundColor: confirmationText.toUpperCase() === 'DELETE' ? '#FF3B30' : colors.border,
                                    opacity: confirmationText.toUpperCase() === 'DELETE' ? 1 : 0.5
                                }]}
                                onPress={handleConfirmDelete}
                                disabled={confirmationText.toUpperCase() !== 'DELETE'}
                            >
                                <Text style={styles.confirmDeleteButtonText}>Delete Forever</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
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
        padding: 20,
    },
    infoCard: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 20,
        marginBottom: 24,
        gap: 16,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    infoText: {
        fontSize: 15,
        fontFamily: 'Nunito-Medium',
    },
    warningCard: {
        borderRadius: 20,
        borderWidth: 2,
        padding: 20,
        marginBottom: 24,
    },
    warningHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    warningTitle: {
        fontSize: 18,
        fontFamily: 'Nunito-Bold',
    },
    warningText: {
        fontSize: 14,
        fontFamily: 'Nunito-Medium',
        lineHeight: 20,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 56,
        borderRadius: 16,
        borderWidth: 2,
        backgroundColor: 'transparent',
    },
    deleteButtonText: {
        color: '#FF3B30',
        fontSize: 16,
        fontFamily: 'Nunito-Bold',
    },
    confirmationCard: {
        borderRadius: 20,
        borderWidth: 2,
        padding: 24,
        gap: 16,
    },
    confirmationTitle: {
        fontSize: 18,
        fontFamily: 'Nunito-Bold',
        textAlign: 'center',
    },
    confirmationSubtext: {
        fontSize: 14,
        fontFamily: 'Nunito-Medium',
        marginTop: 8,
    },
    deleteList: {
        gap: 8,
        marginBottom: 8,
    },
    deleteListItem: {
        fontSize: 14,
        fontFamily: 'Nunito-Medium',
        lineHeight: 20,
    },
    confirmInput: {
        height: 56,
        borderRadius: 16,
        borderWidth: 2,
        paddingHorizontal: 16,
        fontSize: 16,
        textAlign: 'center',
        letterSpacing: 2,
    },
    confirmButtonsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    cancelButton: {
        flex: 1,
        height: 52,
        borderRadius: 14,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontFamily: 'Nunito-Bold',
    },
    confirmDeleteButton: {
        flex: 1,
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmDeleteButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Nunito-Bold',
    },
});
