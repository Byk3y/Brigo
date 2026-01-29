/**
 * usePaywall Hook
 * Provides a simple API to show the custom paywall from anywhere in the app
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';

interface UsePaywallOptions {
    source?: string;
    plan?: 'semester' | 'weekly';
}

interface UsePaywallReturn {
    showPaywall: (overrideOptions?: { plan?: 'semester' | 'weekly' }) => void;
    isPaywallVisible: boolean;
}

/**
 * Hook to show the custom paywall
 * 
 * Usage:
 * ```
 * const { showPaywall } = usePaywall({ source: 'settings' });
 * 
 * <Button onPress={showPaywall} title="Upgrade" />
 * ```
 */
export function usePaywall(options: UsePaywallOptions = {}): UsePaywallReturn {
    const router = useRouter();
    const [isPaywallVisible, setIsPaywallVisible] = useState(false);
    const { source = 'paywall' } = options;

    const showPaywall = useCallback((overrideOptions?: { plan?: 'semester' | 'weekly' }) => {
        setIsPaywallVisible(true);
        const targetPlan = overrideOptions?.plan || options.plan || 'weekly';

        router.push({
            pathname: '/paywall',
            params: { source, plan: targetPlan },
        });
    }, [router, source, options.plan]);

    return {
        showPaywall,
        isPaywallVisible,
    };
}

export default usePaywall;
