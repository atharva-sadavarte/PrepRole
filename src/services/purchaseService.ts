import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
} from 'react-native-purchases';
import {Platform, LogBox} from 'react-native';
import {REVENUECAT_PUBLIC_KEY} from '../config/purchases';

// Ignore RevenueCat setup warnings in dev so RedBox / LogBox modals don't pop up
// while Google Play Console products are in draft/pending review.
LogBox.ignoreLogs([
  '[RevenueCat]',
  'PurchasesError',
  "There's a problem with your configuration",
  'None of the products registered in the RevenueCat dashboard',
]);

let isConfigured = false;

/**
 * Initializes RevenueCat SDK with the authenticated user's ID
 * so purchases are permanently tied to their Supabase account.
 */
export async function initPurchases(userId?: string): Promise<void> {
  if (isConfigured) {
    if (userId) {
      await Purchases.logIn(userId);
    }
    return;
  }

  try {
    // Custom log handler: route error logs to console.warn instead of console.error
    // so React Native doesn't trigger the intrusive full-screen RedBox error modal.
    Purchases.setLogHandler((logLevel, message) => {
      if (logLevel === LOG_LEVEL.ERROR || logLevel === LOG_LEVEL.WARN) {
        console.warn(`[RevenueCat] ${message}`);
      } else if (logLevel === LOG_LEVEL.INFO) {
        console.info(`[RevenueCat] ${message}`);
      } else {
        console.debug(`[RevenueCat] ${message}`);
      }
    });

    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);

    if (Platform.OS === 'android' || !REVENUECAT_PUBLIC_KEY.startsWith('goog_')) {
      Purchases.configure({
        apiKey: REVENUECAT_PUBLIC_KEY,
        appUserID: userId || null,
      });
      isConfigured = true;
      console.log('✅ RevenueCat initialized for user:', userId);
    } else {
      console.log('ℹ️ RevenueCat configured for Android Google Play (iOS StoreKit key can be added in purchases.ts)');
    }
  } catch (err) {
    console.warn('Failed to initialize RevenueCat:', err);
  }
}

/**
 * Fetches available offerings from RevenueCat
 */
export async function getOfferings(): Promise<PurchasesPackage[]> {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current && offerings.current.availablePackages.length !== 0) {
      return offerings.current.availablePackages;
    }
    return [];
  } catch (err: any) {
    // When Google Play products are still in draft or not yet linked in Play Console,
    // getOfferings throws a ConfigurationError. We log it cleanly as info.
    console.log('ℹ️ RevenueCat offerings not active on Play Store yet:', err?.message || err);
    return [];
  }
}

/**
 * Purchases a package (triggers native Google Play bottom sheet)
 */
export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<{customerInfo: CustomerInfo; success: boolean}> {
  try {
    const {customerInfo} = await Purchases.purchasePackage(pkg);
    return {customerInfo, success: true};
  } catch (err: any) {
    if (!err.userCancelled) {
      console.error('RevenueCat purchase error:', err);
      throw err;
    }
    return {customerInfo: {} as CustomerInfo, success: false};
  }
}

/**
 * Restores previous purchases
 */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
  } catch (err) {
    console.error('Error restoring purchases:', err);
    return null;
  }
}

/**
 * Checks if the current user has an active Pro entitlement in RevenueCat
 */
export async function checkProEntitlement(): Promise<boolean> {
  try {
    if (!isConfigured) return false;
    const info = await Purchases.getCustomerInfo();
    return !!info?.entitlements?.active?.pro;
  } catch {
    return false;
  }
}

/**
 * Resets user session in RevenueCat upon app logout
 */
export async function logoutPurchases(): Promise<void> {
  try {
    if (isConfigured) {
      await Purchases.logOut();
      console.log('✅ RevenueCat user logged out');
    }
  } catch (err) {
    console.warn('Failed to logout RevenueCat session:', err);
  }
}
