/**
 * PrepRole - AI-Powered Career Coach
 * Splash → Auth → Dashboard flow
 */

import React, {useEffect, useState} from 'react';
import {supabase} from './src/lib/supabase';
import SplashScreen from './src/screens/SplashScreen';
import AuthScreen from './src/screens/AuthScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import type {Session} from '@supabase/supabase-js';

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

  // Show splash screen first
  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  // After splash, show auth or dashboard based on session
  if (!loading && !session) {
    return <AuthScreen />;
  }

  if (session) {
    return <DashboardScreen session={session} />;
  }

  // Loading state (brief moment while checking session)
  return <SplashScreen onFinish={() => {}} />;
}

export default App;
