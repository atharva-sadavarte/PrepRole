import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
} from 'react-native-purchases';
import {Platform} from 'react-native';
import {REVENUECAT_PUBLIC_KEY} from '../config/purchases';

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
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);

    if (Platform.OS === 'android') {
      Purchases.configure({
        apiKey: REVENUECAT_PUBLIC_KEY,
        appUserID: userId || null,
      });
      isConfigured = true;
      console.log('✅ RevenueCat initialized for user:', userId);
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
  } catch (err) {
    console.warn('Error fetching RevenueCat offerings:', err);
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
