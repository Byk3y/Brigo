/**
 * PaywallScreen - Re-engineered for maximum premium feel
 * Final refinements: Daily cost framing, Unlimited status, Moti animations
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    ScrollView,
    StatusBar,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { MotiView } from 'moti';
import { useTheme } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { getOfferings, purchasePackage, restorePurchases } from '@/lib/purchases';
import { useUpgrade } from '@/lib/hooks/useUpgrade';
import { PurchasesPackage } from 'react-native-purchases';
import { track } from '@/lib/services/analyticsService';
import { APP_URLS } from '@/lib/constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PaywallScreenProps {
    onClose: () => void;
    onPurchaseSuccess?: () => void;
    source?: string;
}

const FEATURES = [
    {
        title: 'Exam Question Predictor',
        description: 'AI-driven insights to predict likely exam questions from your materials.',
        icon: 'analytics',
        color: '#10B981'
    },
    {
        title: 'Unlimited AI Tutor Access',
        description: '24/7 personalized coaching tailored to your learning style.',
        icon: 'sparkles',
        color: '#8B5CF6'
    },
    {
        title: 'Infinite Smart Flashcards',
        description: 'Create and study unlimited cards with adaptive spaced repetition.',
        icon: 'layers',
        color: '#F97316'
    },
    {
        title: 'Personalized Study Podcasts',
        description: 'Convert any length of material into immersive, studio-quality audio summaries.',
        icon: 'headset',
        color: '#3B82F6'
    }
];

export const PaywallScreen: React.FC<PaywallScreenProps> = ({
    onClose,
    onPurchaseSuccess,
    source = 'paywall'
}) => {
    const { isDarkMode } = useTheme();
    const { authUser, loadSubscription } = useStore();
    const { trackUpgradeButtonClicked } = useUpgrade();

    const [isLoading, setIsLoading] = useState(true);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [packages, setPackages] = useState<PurchasesPackage[]>([]);
    const [billingCycle, setBillingCycle] = useState<'semester' | 'weekly'>('semester');

    useEffect(() => {
        const fetchOfferings = async () => {
            try {
                const offering = await getOfferings();
                if (offering) {
                    if (offering.availablePackages.length > 0) {
                        setPackages(offering.availablePackages);
                    }
                }
            } catch (error) {
                // Silent fail - fallback pricing will be shown
            } finally {
                setIsLoading(false);
            }
        };
        fetchOfferings();

        // Track paywall viewed
        track('paywall_viewed', {
            source: source,
        });
    }, []);



    const selectedPackage = packages.find(pkg => {
        if (billingCycle === 'semester') return pkg.packageType === 'THREE_MONTH';
        if (billingCycle === 'weekly') return pkg.packageType === 'WEEKLY';
        return false;
    }) || packages[0];

    // Monthly equivalent for semester (~$6.67/mo for $19.99/3mo)
    const monthlyEquivalent = selectedPackage ? (selectedPackage.product.price / 3).toFixed(2) : '6.67';

    // Extract currency symbol from priceString (e.g., "$19.99" -> "$")
    const currencySymbol = selectedPackage?.product.priceString?.replace(/[0-9.,\s]/g, '') || '$';

    // Total price strings for clarity
    const totalPriceString = selectedPackage?.product.priceString || (
        billingCycle === 'semester' ? `${currencySymbol}17.99` : `${currencySymbol}4.99`
    );
    const trialPriceString = `${currencySymbol}1.99`;
    const durationText = billingCycle === 'semester' ? 'every 3 months' : 'per week';

    const handlePurchase = async () => {
        if (!selectedPackage) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        trackUpgradeButtonClicked(source);
        setIsPurchasing(true);

        try {
            const result = await purchasePackage(selectedPackage);
            if ('userCancelled' in result && result.userCancelled) return;

            if (result.isPro) {
                // Track successful purchase
                track('subscription_purchased', {
                    source: source,
                    plan: billingCycle,
                    price: selectedPackage?.product.price,
                });

                if (authUser) await loadSubscription(authUser.id);
                Alert.alert('🎉 Welcome to Pro!', 'Your study superpowers are now active.', [
                    { text: 'Let\'s Go!', onPress: () => { onPurchaseSuccess?.(); onClose(); } }
                ]);
            }
        } catch (error) {
            Alert.alert('Purchase Failed', 'Please try again.');
        } finally {
            setIsPurchasing(false);
        }
    };

    const handleRestore = async () => {
        setIsRestoring(true);
        try {
            const { isPro } = await restorePurchases();
            if (isPro) {
                // Track restore
                track('subscription_restored', {
                    source: source,
                });

                if (authUser) await loadSubscription(authUser.id);
                Alert.alert('Restored!', 'Your Pro access has been restored.', [{ text: 'Great!', onPress: onClose }]);
            } else {
                Alert.alert('No Purchases Found', 'We couldn\'t find any previous Pro subscriptions.');
            }
        } catch (error) {
            Alert.alert('Restore Failed', 'Please try again.');
        } finally {
            setIsRestoring(false);
        }
    };

    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#FFF' }]}>
                <ActivityIndicator size="large" color="#F97316" />
            </View>
        );
    }

    const isOnboarding = source === 'onboarding';

    return (
        <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#FFF' }]}>
            <StatusBar barStyle="light-content" />

            <LinearGradient
                colors={isDarkMode ? ['#2D1B4D', '#000000'] : ['#F3E8FF', '#FFFFFF']}
                style={styles.headerGradient}
            />

            <SafeAreaView style={styles.safeArea}>
                <View style={styles.topActions}>
                    <TouchableOpacity onPress={onClose} style={styles.iconCircle}>
                        <Ionicons name="close" size={22} color={isDarkMode ? '#FFF' : '#000'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleRestore}>
                        <Text style={[styles.restoreText, { color: isDarkMode ? '#A1A1AA' : '#64748B' }]}>
                            {isRestoring ? 'Restoring...' : 'Restore'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    <View style={styles.headerSection}>
                        <MotiView
                            from={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: 'timing', duration: 800 } as any}
                        >
                            <Text style={[styles.headline, { color: isDarkMode ? '#FFF' : '#111827' }]}>
                                Unlock your personalized study partner today
                            </Text>
                        </MotiView>
                        <Text style={[styles.subHeadline, { color: isDarkMode ? '#A1A1AA' : '#6B7280' }]}>
                            {isOnboarding ? 'Experience the full power of Brigo AI' : 'Choose your plan to get started'}
                        </Text>
                    </View>

                    <View style={[styles.toggleContainer, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6', height: 48 }]}>
                        <TouchableOpacity
                            style={[styles.toggleHalf, billingCycle === 'weekly' && styles.toggleActive]}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setBillingCycle('weekly');
                                track('paywall_plan_changed', { plan: 'weekly' });
                            }}
                        >
                            <Text style={[styles.toggleText, billingCycle === 'weekly' && styles.toggleTextActive]}>Weekly</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.toggleHalf, billingCycle === 'semester' && styles.toggleActive]}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setBillingCycle('semester');
                                track('paywall_plan_changed', { plan: 'semester' });
                            }}
                        >
                            <View style={styles.toggleLabelRow}>
                                <Text style={[styles.toggleText, billingCycle === 'semester' && styles.toggleTextActive]}>Semester</Text>
                                <View style={styles.savingsBadgeMini}>
                                    <Text style={styles.savingsBadgeTextMini}>72% OFF</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.featuresList}>
                        {FEATURES.map((item, index) => (
                            <MotiView
                                key={index}
                                from={{ opacity: 0, translateX: -20 }}
                                animate={{ opacity: 1, translateX: 0 }}
                                transition={{ type: 'timing', duration: 400, delay: 300 + (index * 100) } as any}
                                style={styles.featureRow}
                            >
                                <View style={[styles.featureIconBox, { backgroundColor: isDarkMode ? '#27272A' : '#FAFAFA', shadowOpacity: isDarkMode ? 0 : 0.05 }]}>
                                    <Ionicons name={item.icon as any} size={24} color={item.color} />
                                </View>
                                <View style={styles.featureContent}>
                                    <Text style={[styles.featureTitle, { color: isDarkMode ? '#FFF' : '#111827' }]}>{item.title}</Text>
                                    <Text style={[styles.featureDesc, { color: isDarkMode ? '#A1A1AA' : '#6B7280' }]}>{item.description}</Text>
                                </View>
                            </MotiView>
                        ))}
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    {billingCycle === 'semester' && (
                        <View style={styles.valuePropositionFooter}>
                            <Ionicons name="sparkles" size={16} color="#10B981" />
                            <Text style={[styles.valueText, { color: isDarkMode ? '#10B981' : '#059669' }]}>
                                3 months for just {currencySymbol}1.38/week
                            </Text>
                        </View>
                    )}
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: isDarkMode ? '#FFF' : '#000' }]}
                        onPress={handlePurchase}
                        disabled={isPurchasing}
                        activeOpacity={0.9}
                    >
                        {isPurchasing ? (
                            <ActivityIndicator color={isDarkMode ? '#000' : '#FFF'} />
                        ) : (
                            <View style={styles.buttonInnerCentric}>
                                <Text style={[styles.buttonLabel, { color: isDarkMode ? '#000' : '#FFF' }]}>
                                    {billingCycle === 'weekly' ? `Start 7-day trial for ${trialPriceString}` : 'Start Your Semester'}
                                </Text>
                                <Text style={[styles.buttonPriceInline, { color: '#F97316' }]}>
                                    {billingCycle === 'weekly' ? `then ${totalPriceString}/wk` : totalPriceString}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <Text style={[styles.legalNote, { color: isDarkMode ? '#71717A' : '#9CA3AF' }]}>
                        {billingCycle === 'weekly'
                            ? `Billed ${trialPriceString} today. After 7 days, billed ${totalPriceString} per week. Cancel anytime.`
                            : `Billed ${totalPriceString} for 3 months. Plan continues at regular price. Cancel anytime in App Store.`
                        }
                    </Text>

                    <View style={styles.legalLinks}>
                        <TouchableOpacity onPress={() => Linking.openURL(APP_URLS.TERMS)}>
                            <Text style={[styles.legalLinkText, { color: isDarkMode ? '#A1A1AA' : '#64748B' }]}>Terms of Use</Text>
                        </TouchableOpacity>
                        <View style={[styles.legalSeparator, { backgroundColor: isDarkMode ? '#3F3F46' : '#E5E7EB' }]} />
                        <TouchableOpacity onPress={() => Linking.openURL(APP_URLS.PRIVACY)}>
                            <Text style={[styles.legalLinkText, { color: isDarkMode ? '#A1A1AA' : '#64748B' }]}>Privacy Policy</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: SCREEN_HEIGHT * 0.35,
    },
    safeArea: { flex: 1 },
    topActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    restoreText: {
        fontSize: 14,
        fontFamily: 'Outfit-Medium',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 20,
    },
    headerSection: {
        alignItems: 'center',
        marginBottom: 35,
    },
    headline: {
        fontSize: SCREEN_WIDTH > 400 ? 34 : 30,
        fontFamily: 'Outfit-Bold',
        textAlign: 'center',
        lineHeight: 40,
        marginBottom: 10,
        paddingHorizontal: 20,
    },
    subHeadline: {
        fontSize: 16,
        fontFamily: 'Outfit-Regular',
        textAlign: 'center',
        opacity: 0.7,
    },
    toggleContainer: {
        flexDirection: 'row',
        borderRadius: 24,
        padding: 4,
        marginBottom: 24,
    },
    toggleHalf: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 24,
    },
    toggleThird: {
        flex: 1,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
    },
    toggleActive: {
        backgroundColor: '#F97316',
        shadowColor: '#F97316',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    toggleText: {
        fontSize: 15,
        fontFamily: 'Outfit-Medium',
        color: '#6B7280',
    },
    toggleTextActive: {
        color: '#111827',
    },
    toggleLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    savingsBadge: {
        backgroundColor: '#F97316',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    savingsBadgeText: {
        color: '#FFF',
        fontSize: 10,
        fontFamily: 'Outfit-Bold',
    },
    savingsBadgeMini: {
        backgroundColor: '#10B981',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
        marginLeft: 4,
    },
    savingsBadgeTextMini: {
        color: '#FFF',
        fontSize: 8,
        fontWeight: '800',
        fontFamily: 'Nunito-Bold',
    },
    valueProposition: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 24,
        marginTop: -15,
    },
    valuePropositionFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 12,
    },
    valueText: {
        fontSize: 13,
        fontFamily: 'Outfit-Bold',
    },
    featuresList: {
        gap: 20,
        backgroundColor: 'rgba(0,0,0,0.02)',
        padding: 16,
        borderRadius: 20,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    featureIconBox: {
        width: 44,
        height: 44,
        borderRadius: 22, // Round like reference
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 1,
    },
    featureContent: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 16,
        fontFamily: 'Outfit-Bold',
        marginBottom: 2,
    },
    featureDesc: {
        fontSize: 13,
        fontFamily: 'Outfit-Regular',
        lineHeight: 18,
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 20,
        paddingTop: 10,
    },
    actionButton: {
        height: 64, // Slightly taller
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 6,
    },
    buttonInnerCentric: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    buttonLabel: {
        fontSize: 18,
        fontFamily: 'Outfit-Bold',
    },
    buttonPriceInline: {
        fontSize: 16,
        fontFamily: 'Outfit-Bold',
    },
    legalNote: {
        fontSize: 12,
        fontFamily: 'Outfit-Regular',
        marginTop: 14,
        textAlign: 'center',
        opacity: 0.5,
    },
    legalLinks: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
        gap: 12,
    },
    legalLinkText: {
        fontSize: 11,
        fontFamily: 'Outfit-Medium',
        textDecorationLine: 'underline',
    },
    legalSeparator: {
        width: 1,
        height: 12,
    }
});

export default PaywallScreen;
