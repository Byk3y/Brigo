import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { restorePurchases } from '@/lib/purchases';
import { usePaywall } from '@/lib/hooks/usePaywall';
import { BrigoLogo } from '@/components/BrigoLogo';
const isPad = Platform.OS === 'ios' && Platform.isPad;
export default function SubscriptionScreen() {
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);
    const router = useRouter();
    const { tier, isExpired, loadSubscription, authUser } = useStore();
    const { showPaywall } = usePaywall({ source: 'settings_subscription' });

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

    const handlePresentPaywall = () => {
        showPaywall();
    };

    const handleOpenCustomerCenter = () => {
        if (Platform.OS === 'ios') {
            Linking.openURL('https://apps.apple.com/account/subscriptions');
        } else {
            Linking.openURL('https://play.google.com/store/account/subscriptions');
        }
    };

    const isPro = tier === 'premium' && !isExpired;
    const statusText = isPro
        ? 'Premium • Active'
        : 'Free • Upgrade to unlock all features';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#111' : '#F9FAFB' }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={isDarkMode ? '#FFF' : '#111827'} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: isDarkMode ? '#FFF' : '#111827' }]}>Subscription</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <LinearGradient
                    colors={isPro ? ['#8B5CF6', '#7C3AED'] : ['#3B82F6', '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.premiumCard}
                >
                    <View style={styles.cardHeader}>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{isPro ? 'PRO' : 'FREE'}</Text>
                        </View>
                        <Text style={styles.statusText}>{statusText}</Text>
                    </View>

                    <View style={styles.planTitleRow}>
                        <BrigoLogo size={28} textColor="#FFFFFF" />
                        {isPro && <Text style={styles.planTitlePro}> Pro</Text>}
                    </View>

                    <Text style={styles.planTagline}>
                        {isPro
                            ? 'Unlimited notebooks • Priority AI access'
                            : 'Upgrade to unlock unlimited features'
                        }
                    </Text>

                    <View style={styles.featuresList}>
                        {[
                            { text: isPro ? 'Unlimited Studio generations' : 'Limited Studio generations' },
                            { text: isPro ? 'Unlimited Podcasts' : 'Limited Podcasts' },
                            { text: 'Interactive Smart Chat' }
                        ].map((f, i) => (
                            <View key={i} style={styles.featureItem}>
                                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                                <Text style={styles.featureText}>{f.text}</Text>
                            </View>
                        ))}
                    </View>
                </LinearGradient>

                {!isPro && (
                    <TouchableOpacity
                        style={[styles.upgradeButton, { backgroundColor: isDarkMode ? '#FFF' : '#000' }]}
                        onPress={handlePresentPaywall}
                        activeOpacity={0.9}
                    >
                        <View style={styles.buttonInner}>
                            <Text style={[styles.upgradeButtonText, { color: isDarkMode ? '#000' : '#FFF' }]}>UPGRADE TO PRO</Text>
                            <Ionicons name="sparkles" size={18} color={isDarkMode ? '#000' : '#FFF'} />
                        </View>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={[styles.manageButton, {
                        backgroundColor: isDarkMode ? '#1F2937' : '#FFF',
                        borderColor: isDarkMode ? '#374151' : '#E5E7EB'
                    }]}
                    onPress={handleOpenCustomerCenter}
                >
                    <View style={styles.manageButtonLeft}>
                        <Ionicons name="card-outline" size={22} color={isDarkMode ? '#A1A1AA' : '#64748B'} />
                        <Text style={[styles.manageButtonText, { color: isDarkMode ? '#FFF' : '#111827' }]}>Manage Billing</Text>
                    </View>
                    <Ionicons name="open-outline" size={18} color={isDarkMode ? '#4B5563' : '#9CA3AF'} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
                    <Text style={[styles.restoreButtonText, { color: isDarkMode ? '#6B7280' : '#4B5563' }]}>RESTORE PURCHASES</Text>
                </TouchableOpacity>

                <View style={styles.footer}>
                    <Text style={[styles.footerText, { color: isDarkMode ? '#71717A' : '#9CA3AF' }]}>
                        Subscription renews automatically unless canceled in settings.
                    </Text>
                </View>
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
    backButton: {
        padding: isPad ? 8 : 4,
    },
    headerTitle: {
        fontSize: isPad ? 28 : 18,
        fontFamily: 'Nunito-Bold',
    },
    content: {
        padding: isPad ? 40 : 24,
        maxWidth: isPad ? 720 : '100%',
        alignSelf: 'center',
        width: '100%',
    },
    premiumCard: {
        borderRadius: isPad ? 32 : 24,
        padding: isPad ? 32 : 24,
        marginBottom: isPad ? 40 : 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 6,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    badge: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: isPad ? 14 : 11,
        fontFamily: 'Nunito-Bold',
        color: '#FFFFFF',
        letterSpacing: 1,
    },
    statusText: {
        fontSize: isPad ? 16 : 12,
        fontFamily: 'Nunito-Bold',
        color: '#FFFFFF',
        opacity: 0.9,
    },
    planTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    planTitlePro: {
        fontSize: isPad ? 36 : 26,
        fontFamily: 'Nunito-Bold',
        color: '#FFFFFF',
    },
    planTagline: {
        fontSize: isPad ? 18 : 15,
        fontFamily: 'Nunito-Medium',
        color: '#FFFFFF',
        opacity: 0.85,
        marginBottom: isPad ? 32 : 26,
    },
    featuresList: {
        gap: 12,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: isPad ? 16 : 12,
    },
    featureText: {
        fontSize: isPad ? 18 : 15,
        fontFamily: 'Nunito-Medium',
        color: '#FFFFFF',
    },
    upgradeButton: {
        height: isPad ? 72 : 64,
        borderRadius: isPad ? 24 : 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: isPad ? 24 : 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 3,
    },
    buttonInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: isPad ? 12 : 8,
    },
    upgradeButtonText: {
        fontSize: isPad ? 20 : 16,
        fontFamily: 'Nunito-Bold',
        letterSpacing: 0.5,
    },
    manageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isPad ? 24 : 18,
        borderRadius: isPad ? 24 : 20,
        borderWidth: 1,
    },
    manageButtonLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: isPad ? 16 : 12,
    },
    manageButtonText: {
        fontSize: isPad ? 20 : 16,
        fontFamily: 'Nunito-Bold',
    },
    restoreButton: {
        alignItems: 'center',
        padding: 24,
        marginTop: 8,
    },
    restoreButtonText: {
        fontSize: isPad ? 16 : 14,
        fontFamily: 'Nunito-Bold',
        letterSpacing: 0.8,
    },
    footer: {
        paddingHorizontal: 20,
        marginTop: 8,
    },
    footerText: {
        textAlign: 'center',
        fontSize: isPad ? 15 : 12,
        fontFamily: 'Nunito-Regular',
        lineHeight: isPad ? 22 : 18,
        opacity: 0.6,
    }
});
