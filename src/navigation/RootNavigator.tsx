import React from 'react';
import type {Session} from '@supabase/supabase-js';
import SplashScreen from '../screens/SplashScreen';
import AuthScreen from '../screens/AuthScreen';
import BottomTabNavigator from './BottomTabNavigator';

interface RootNavigatorProps {
  session: Session | null;
  showSplash: boolean;
  onSplashFinish: () => void;
}

export const RootNavigator: React.FC<RootNavigatorProps> = ({
  session,
  showSplash,
  onSplashFinish,
}) => {
  if (showSplash) {
    return <SplashScreen onFinish={onSplashFinish} />;
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <BottomTabNavigator session={session} />;
};

export default RootNavigator;
