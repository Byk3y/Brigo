/**
 * Paywall Route
 * Full-screen paywall presented as a modal
 */

import { useRouter, useLocalSearchParams } from 'expo-router';
import PaywallScreen from '@/components/upgrade/PaywallScreen';

export default function PaywallRoute() {
    const router = useRouter();
    const { source, plan } = useLocalSearchParams<{ source?: string, plan?: string }>();

    const handleClose = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/');
        }
    };

    const handlePurchaseSuccess = () => {
        // Navigate to main app after successful purchase
        router.replace('/');
    };

    return (
        <PaywallScreen
            onClose={handleClose}
            onPurchaseSuccess={handlePurchaseSuccess}
            source={source || 'paywall'}
            initialBillingCycle={plan === 'monthly' || plan === 'yearly' ? plan : 'monthly'}
        />
    );
}
