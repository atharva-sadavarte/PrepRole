/**
 * PrepRole - AI-Powered Career Coach
 * Navigation flow: Splash → Auth → Dashboard → CV Analyzer → Score Results
 */

import React, {useEffect, useState} from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {supabase} from './src/lib/supabase';
import RootNavigator from './src/navigation/RootNavigator';
import SplashScreen from './src/screens/SplashScreen';
import type {Session} from '@supabase/supabase-js';
import {ThemeProvider, useTheme} from './src/context/ThemeContext';

function AppNavigation({
  session,
  showSplash,
  handleSplashFinish,
}: {
  session: Session | null;
  showSplash: boolean;
  handleSplashFinish: () => void;
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
      />
    </NavigationContainer>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({data: {session: currentSession}}) => {
      setSession(currentSession);
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: {subscription},
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        {loading && showSplash ? (
          <SplashScreen onFinish={handleSplashFinish} />
        ) : (
          <AppNavigation
            session={session}
            showSplash={showSplash}
            handleSplashFinish={handleSplashFinish}
          />
        )}
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

export default App;

