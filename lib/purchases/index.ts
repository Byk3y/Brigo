import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';
import Constants from 'expo-constants';
import { REVENUECAT_CONFIG } from '@/lib/constants';

/**
 * Purchases Service - Thin wrapper around RevenueCat SDK
 */

let initializationPromise: Promise<void> | null = null;

/**
 * Check if the app is running inside Expo Go
 */
const isExpoGo = Constants.appOwnership === 'expo';

/**
 * Initialize RevenueCat SDK
 * Should be called once at app startup
 */
export const initializePurchases = async (userId?: string) => {
    // Skip RevenueCat in Expo Go as it requires a development build for native features
    if (isExpoGo) {
        if (__DEV__) {
            console.log('[RevenueCat] Skipping initialization in Expo Go environment.');
        }
        return;
    }

    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
        if (__DEV__ || Platform.OS === 'android') {
            Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
        }

        const apiKey = Platform.select({
            ios: REVENUECAT_CONFIG.APPLE_KEY,
            android: REVENUECAT_CONFIG.GOOGLE_KEY,
        });

        if (!apiKey) {
            if (__DEV__) {
                console.warn('RevenueCat API key not found for this platform.');
            }
            return;
        }

        // Prevent double initialization
        const isConfigured = await Purchases.isConfigured();
        if (isConfigured) {
            if (__DEV__) {
                console.log('[RevenueCat] Already configured, skipping repeat initialization.');
            }
            return;
        }

        // Configure the SDK
        Purchases.configure({ apiKey, appUserID: userId });

        if (__DEV__) {
            console.log('[RevenueCat] Initialized successfully');
        }
    })();

    return initializationPromise;
};

/**
 * Log in a user to RevenueCat
 * Call this after your own auth system identifies the user
 */
export const identifyPurchaser = async (userId: string) => {
    try {
        await initializePurchases();
        const { customerInfo, created } = await Purchases.logIn(userId);
        return { customerInfo, created };
    } catch (error) {
        console.error('[RevenueCat] Error logging in:', error);
        throw error;
    }
};

/**
 * Log out from RevenueCat
 */
export const logoutPurchaser = async () => {
    try {
        await initializePurchases();
        await Purchases.logOut();
    } catch (error) {
        console.error('[RevenueCat] Error logging out:', error);
    }
};

/**
 * Get the current purchaser info
 */
export const getCustomerInfo = async () => {
    try {
        await initializePurchases();
        return await Purchases.getCustomerInfo();
    } catch (error) {
        console.error('[RevenueCat] Error getting customer info:', error);
        return null;
    }
};

/**
 * Check if the user has a specific entitlement active
 */
export const checkProEntitlement = async (): Promise<boolean> => {
    try {
        await initializePurchases();
        const info = await Purchases.getCustomerInfo();
        return !!info.entitlements.active[REVENUECAT_CONFIG.ENTITLEMENT_ID];
    } catch (error) {
        console.error('[RevenueCat] Error checking entitlement:', error);
        return false;
    }
};

/**
 * Purchase a package
 */
export const purchasePackage = async (rcPackage: PurchasesPackage) => {
    try {
        const { customerInfo, productIdentifier } = await Purchases.purchasePackage(rcPackage);
        const isPro = !!customerInfo.entitlements.active[REVENUECAT_CONFIG.ENTITLEMENT_ID];
        return { isPro, productIdentifier, customerInfo };
    } catch (error: any) {
        if (!error.userCancelled) {
            console.error('[RevenueCat] Error purchasing package:', error);
            throw error;
        }
        return { userCancelled: true };
    }
};

/**
 * Restore purchases
 */
export const restorePurchases = async () => {
    try {
        const customerInfo = await Purchases.restorePurchases();
        const isPro = !!customerInfo.entitlements.active[REVENUECAT_CONFIG.ENTITLEMENT_ID];
        return { isPro, customerInfo };
    } catch (error) {
        console.error('[RevenueCat] Error restoring purchases:', error);
        throw error;
    }
};

/**
 * Get the available offerings/products
 */
export const getOfferings = async () => {
    try {
        await initializePurchases();
        const offerings = await Purchases.getOfferings();
        if (offerings.current !== null) {
            return offerings.current;
        }
        return null;
    } catch (error) {
        console.error('[RevenueCat] Error getting offerings:', error);
        return null;
    }
};
