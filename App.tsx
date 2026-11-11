/**
 * PrepRole - AI-Powered Career Coach
 * Navigation flow: Splash → Auth → Dashboard → CV Analyzer → Score Results
 */

import React, {useEffect, useState} from 'react';
import {Linking, Alert, LogBox} from 'react-native';

LogBox.ignoreLogs([
  'PGRST303',
  'JWT issued at future',
]);
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {supabase} from './src/lib/supabase';
import RootNavigator from './src/navigation/RootNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SplashScreen from './src/screens/SplashScreen';
import type {Session} from '@supabase/supabase-js';
import {ThemeProvider, useTheme} from './src/context/ThemeContext';
import {QuotaProvider} from './src/context/QuotaContext';
import {initPurchases} from './src/services/purchaseService';
import {handleAuthUrl} from './src/services/authService';
import ForgotPasswordModal from './src/components/ForgotPasswordModal';

function AppNavigation({
  session,
  showSplash,
  handleSplashFinish,
  hasCompletedOnboarding,
  handleFinishOnboarding,
}: {
  session: Session | null;
  showSplash: boolean;
  handleSplashFinish: () => void;
  hasCompletedOnboarding: boolean;
  handleFinishOnboarding: () => void;
}) {
  const {colors, isDark} = useTheme();
  const baseTheme = isDark ? DarkTheme : DefaultTheme;

  const navTheme = {
    ...baseTheme,
    dark: isDark,
    colors: {
      ...baseTheme.colors,
      primary: colors.primaryStart,
      background: colors.bgDark,
      card: colors.bgCard,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <RootNavigator
        session={session}
        showSplash={showSplash}
        onSplashFinish={handleSplashFinish}
        hasCompletedOnboarding={hasCompletedOnboarding}
        onFinishOnboarding={handleFinishOnboarding}
      />
    </NavigationContainer>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    // Handle deep links when app opens or receives incoming URL
    Linking.getInitialURL().then(url => {
      if (url) {
        handleAuthUrl(url).then(res => {
          if (res?.type === 'recovery') {
            setIsPasswordRecovery(true);
          }
        });
      }
    });

    const urlSub = Linking.addEventListener('url', ({url}) => {
      if (url) {
        handleAuthUrl(url).then(res => {
          if (res?.type === 'recovery') {
            setIsPasswordRecovery(true);
          }
        });
      }
    });

    // Check onboarding status
    AsyncStorage.getItem('@has_completed_onboarding')
      .then(value => {
        if (value === null) {
          // First launch - show onboarding
          setHasCompletedOnboarding(false);
        } else {
          setHasCompletedOnboarding(value === 'true');
        }
      })
      .catch(() => {
        setHasCompletedOnboarding(true);
      });

    // Check for existing session
    supabase.auth.getSession().then(({data: {session: currentSession}}) => {
      setSession(currentSession);
      if (currentSession?.user?.id) {
        initPurchases(currentSession.user.id);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: {subscription},
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      setSession(newSession);
      if (newSession?.user?.id) {
        initPurchases(newSession.user.id);
      }
    });

    return () => {
      urlSub.remove();
      subscription.unsubscribe();
    };
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  const handleFinishOnboarding = async () => {
    try {
      await AsyncStorage.setItem('@has_completed_onboarding', 'true');
    } catch (err) {
      console.warn('Failed to save onboarding completion state:', err);
    }
    setHasCompletedOnboarding(true);
  };

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <QuotaProvider session={session}>
          <AppNavigation
            session={session}
            showSplash={showSplash}
            handleSplashFinish={handleSplashFinish}
            hasCompletedOnboarding={hasCompletedOnboarding}
            handleFinishOnboarding={handleFinishOnboarding}
          />
          <ForgotPasswordModal
            visible={isPasswordRecovery}
            isDirectRecovery={true}
            onClose={() => setIsPasswordRecovery(false)}
            onSuccess={() => {
              setIsPasswordRecovery(false);
              Alert.alert(
                'Password Updated',
                'Your password has been successfully updated.',
              );
            }}
          />
        </QuotaProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

export default App;

