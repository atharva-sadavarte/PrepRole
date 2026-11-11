import {Platform} from 'react-native';

export const REVENUECAT_GOOGLE_API_KEY = 'goog_boZnoeyrmenkGavcTDqTUeBOjkB';
export const REVENUECAT_APPLE_API_KEY = ''; // Add Apple StoreKit API key here when publishing to iOS

export const REVENUECAT_PUBLIC_KEY =
  Platform.OS === 'ios' ? REVENUECAT_APPLE_API_KEY : REVENUECAT_GOOGLE_API_KEY;
