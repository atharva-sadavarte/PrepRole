import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {Session} from '@supabase/supabase-js';
import SplashScreen from '../screens/SplashScreen';
import AuthScreen from '../screens/AuthScreen';
import DashboardScreen from '../screens/DashboardScreen';
import CVUploadScreen from '../screens/CVUploadScreen';
import CVScoreResultScreen from '../screens/CVScoreResultScreen';
import ScoreHistoryScreen from '../screens/ScoreHistoryScreen';
import {ResumeAnalysisRecord} from '../types/resume';

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Dashboard: undefined;
  CVUpload: undefined;
  CVScoreResult: {analysis: ResumeAnalysisRecord};
  ScoreHistory: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

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

  return (
    <Stack.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: {backgroundColor: '#0A0E21'},
      }}>
      <Stack.Screen name="Dashboard">
        {props => <DashboardScreen {...props} session={session} />}
      </Stack.Screen>
      <Stack.Screen name="CVUpload">
        {props => <CVUploadScreen {...props} session={session} />}
      </Stack.Screen>
      <Stack.Screen
        name="CVScoreResult"
        component={CVScoreResultScreen}
      />
      <Stack.Screen name="ScoreHistory">
        {props => <ScoreHistoryScreen {...props} session={session} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

export default RootNavigator;
