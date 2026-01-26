import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { APP_URLS, APP_CONFIG } from '@/lib/constants';
import { restorePurchases } from '@/lib/purchases';
import { notificationService } from '@/lib/services/notificationService';
const isPad = Platform.OS === 'ios' && Platform.isPad;
export default function SettingsScreen() {
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);
    const router = useRouter();
    const { authUser, resetPetState, tier, isExpired, loadSubscription } = useStore();

    // Navigation guard to prevent double-click issues
    const isNavigating = useRef(false);

    // Handle restore purchases
    const handleRestore = async () => {
        try {
            const { isPro } = await restorePurchases();
            if (isPro) {
                if (authUser) await loadSubscription(authUser.id);
                Alert.alert("Success", "Your purchases have been restored.");
            } else {
                Alert.alert("Notice", "No active subscriptions found to restore.");
            }
        } catch (error) {
            Alert.alert("Error", "Failed to restore purchases. Please try again later.");
        }
    };

    // Calculate subscription status
    const isPro = tier === 'premium' && !isExpired;
    const subscriptionSubtext = isPro ? 'Pro • Active' : 'Free • Tap to upgrade';


    const handleOpenURL = async (url: string) => {
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                Alert.alert("Error", `Cannot open URL: ${url}`);
            }
        } catch (error) {
            console.error('Error opening URL:', error);
            Alert.alert("Error", "Something went wrong while trying to open the link.");
        }
    };

    const handleSignOut = async () => {
        Alert.alert(
            "Sign Out",
            "Are you sure you want to sign out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Sign Out",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            // Clear push token before signing out
                            if (authUser?.id) {
                                await notificationService.clearTokenFromProfile(authUser.id);
                            }
                            await supabase.auth.signOut();
                            // Logic for clearing state and redirecting is handled 
                            // centrally by useAuthSetup and useRoutingLogic
                        } catch (error) {
                            console.error('Error signing out:', error);
                            // Fallback if sign out fails
                            router.replace('/auth');
                        }
                    }
                }
            ]
        );
    };

    const NavItem = ({ label, icon, route, action, subtext, color }: { label: string, icon: string, route?: string, action?: () => void, subtext?: string, color?: string }) => (
        <TouchableOpacity
            style={[styles.navItem, { borderBottomColor: colors.borderLight }]}
            onPress={() => {
                if (action) {
                    action();
                } else if (route) {
                    // Prevent double navigation
                    if (isNavigating.current) return;
                    isNavigating.current = true;
                    router.push(route as any);
                    // Reset after a short delay
                    setTimeout(() => {
                        isNavigating.current = false;
                    }, 500);
                }
            }}
            activeOpacity={0.7}
        >
            <View style={styles.navItemLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? '#3a3a3c' : '#f2f2f7' }]}>
                    <Ionicons name={icon as any} size={22} color={color || colors.textSecondary} />
                </View>
                <View>
                    <Text style={[styles.navLabel, { color: colors.text }]}>{label}</Text>
                    {subtext && <Text style={[styles.navSubtext, { color: colors.textMuted }]}>{subtext}</Text>}
                </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                    <Ionicons name="close" size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* ACCOUNT SECTION */}
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ACCOUNT</Text>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <NavItem
                        label="Preferences"
                        icon="color-palette"
                        route="/settings/preferences"
                        subtext="Theme and appearance"
                    />
                    <NavItem
                        label="Audio"
                        icon="volume-high"
                        route="/settings/audio"
                        subtext="Sound and playback"
                    />
                    <NavItem
                        label="Profile"
                        icon="person"
                        route="/settings/profile"
                        subtext="Edit your name"
                    />
                    <NavItem
                        label="Notifications"
                        icon="notifications"
                        route="/settings/notifications"
                        subtext="Alerts and reminders"
                    />
                    <NavItem
                        label="Account Management"
                        icon="shield-checkmark"
                        route="/settings/account"
                        subtext="Security and account options"
                    />
                </View>

                {/* SUBSCRIPTION SECTION */}
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SUBSCRIPTION</Text>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <NavItem
                        label="Manage Subscription"
                        icon="card"
                        route="/settings/subscription"
                        subtext={subscriptionSubtext}
                    />
                    <TouchableOpacity style={styles.restoreRow} onPress={handleRestore}>
                        <Text style={[styles.restoreText, { color: colors.primary }]}>RESTORE PURCHASES</Text>
                    </TouchableOpacity>
                </View>

                {/* SUPPORT SECTION */}
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SUPPORT</Text>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <NavItem
                        label="Help Center"
                        icon="help-circle"
                        action={() => handleOpenURL(APP_URLS.SUPPORT)}
                        subtext="Get help with Brigo"
                    />
                    <NavItem
                        label="Feedback"
                        icon="chatbubble"
                        action={() => handleOpenURL(`mailto:${APP_CONFIG.SUPPORT_EMAIL}?subject=App Feedback`)}
                        subtext="Tell us what you think"
                    />
                    <TouchableOpacity style={styles.signOutRow} onPress={handleSignOut}>
                        <Text style={styles.signOutText}>SIGN OUT</Text>
                    </TouchableOpacity>
                </View>

                {/* Legal Links */}
                <View style={styles.footer}>
                    <TouchableOpacity onPress={() => handleOpenURL(APP_URLS.TERMS)}>
                        <Text style={[styles.footerText, { color: colors.textMuted }]}>Terms of Service</Text>
                    </TouchableOpacity>
                    <View style={[styles.footerDivider, { backgroundColor: colors.textMuted }]} />
                    <TouchableOpacity onPress={() => handleOpenURL(APP_URLS.PRIVACY)}>
                        <Text style={[styles.footerText, { color: colors.textMuted }]}>Privacy Policy</Text>
                    </TouchableOpacity>
                </View>

                <Text style={[styles.versionText, { color: colors.textMuted }]}>Version 1.0.0 (2026)</Text>
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
        paddingHorizontal: isPad ? 48 : 16,
        paddingVertical: isPad ? 24 : 12,
        width: '100%',
    },
    closeButton: {
        padding: isPad ? 8 : 4,
    },
    headerTitle: {
        fontSize: isPad ? 28 : 20,
        fontFamily: 'Nunito-Bold',
    },
    scrollContent: {
        padding: isPad ? 40 : 20,
        maxWidth: isPad ? 720 : '100%',
        alignSelf: 'center',
        width: '100%',
    },
    sectionTitle: {
        fontSize: isPad ? 16 : 12,
        fontFamily: 'Nunito-Bold',
        letterSpacing: 1.2,
        marginBottom: isPad ? 16 : 10,
        marginLeft: isPad ? 8 : 4,
    },
    card: {
        borderRadius: isPad ? 32 : 20,
        borderWidth: 1,
        overflow: 'hidden',
        marginBottom: isPad ? 40 : 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isPad ? 24 : 16,
        borderBottomWidth: 1,
    },
    navItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: isPad ? 20 : 12,
    },
    iconWrapper: {
        width: isPad ? 48 : 36,
        height: isPad ? 48 : 36,
        borderRadius: isPad ? 14 : 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    navLabel: {
        fontSize: isPad ? 20 : 16,
        fontFamily: 'Nunito-Bold',
    },
    navSubtext: {
        fontSize: isPad ? 15 : 12,
        fontFamily: 'Nunito-Medium',
        marginTop: isPad ? 2 : -2,
    },
    restoreRow: {
        padding: isPad ? 32 : 16,
        alignItems: 'center',
    },
    restoreText: {
        fontSize: isPad ? 18 : 14,
        fontFamily: 'Nunito-Bold',
        letterSpacing: 0.5,
    },
    signOutRow: {
        padding: isPad ? 32 : 16,
        alignItems: 'center',
    },
    signOutText: {
        color: '#FF3B30',
        fontSize: isPad ? 20 : 16,
        fontFamily: 'Nunito-Bold',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isPad ? 20 : 12,
        marginTop: isPad ? 40 : 8,
    },
    footerText: {
        fontSize: isPad ? 18 : 13,
        fontFamily: 'Nunito-Medium',
    },
    footerDivider: {
        width: 4,
        height: 4,
        borderRadius: 2,
        opacity: 0.3,
    },
    versionText: {
        textAlign: 'center',
        fontSize: isPad ? 16 : 12,
        fontFamily: 'Nunito-Regular',
        marginTop: isPad ? 40 : 20,
        opacity: 0.6,
    }
});
