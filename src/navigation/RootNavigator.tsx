import React from 'react';
import type {Session} from '@supabase/supabase-js';
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import AuthScreen from '../screens/AuthScreen';
import BottomTabNavigator from './BottomTabNavigator';

interface RootNavigatorProps {
  session: Session | null;
  showSplash: boolean;
  onSplashFinish: () => void;
  hasCompletedOnboarding: boolean;
  onFinishOnboarding: () => void;
}

export const RootNavigator: React.FC<RootNavigatorProps> = ({
  session,
  showSplash,
  onSplashFinish,
  hasCompletedOnboarding,
  onFinishOnboarding,
}) => {
  if (showSplash) {
    return <SplashScreen onFinish={onSplashFinish} />;
  }

  // If user hasn't completed onboarding and isn't authenticated yet, show onboarding
  if (!hasCompletedOnboarding && !session) {
    return <OnboardingScreen onFinish={onFinishOnboarding} />;
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <BottomTabNavigator session={session} />;
};

export default RootNavigator;
