/**
 * App-wide Constants
 * Centralized configuration for URLs, app settings, and other constants
 */

/**
 * External URLs
 */
export const APP_URLS = {
  TERMS: 'https://brigo.app/terms',
  PRIVACY: 'https://brigo.app/privacy',
  SUPPORT: 'https://brigo.app/support',
  WEBSITE: 'https://brigo.app',
} as const;

/**
 * App Configuration
 */
export const APP_CONFIG = {
  APP_NAME: 'Brigo',
  SUPPORT_EMAIL: 'support@brigo.app',
} as const;

/**
 * Subscription Constants
 */
export const SUBSCRIPTION_CONSTANTS = {
  LIMITED_ACCESS_NOTEBOOK_COUNT: 3,
  LOCKED_NOTEBOOK_OVERLAY_DELAY_MS: 2500,
  SUBSCRIPTION_EXPIRED_MODAL_SHOWN_KEY: 'subscription_expired_modal_shown',
} as const;

/**
 * RevenueCat Configuration
 */
export const REVENUECAT_CONFIG = {
  APPLE_KEY: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || '',
  GOOGLE_KEY: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || '',
  ENTITLEMENT_ID: 'brigo_pro',
} as const;





