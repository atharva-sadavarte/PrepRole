import React from 'react';
import {View, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import Icon from '../components/Icon';
import {useTheme} from '../context/ThemeContext';
import {TAB_BAR, FONTS} from '../lib/theme';
import type {Session} from '@supabase/supabase-js';

import DashboardScreen from '../screens/DashboardScreen';
import CVUploadScreen from '../screens/CVUploadScreen';
import CVScoreResultScreen from '../screens/CVScoreResultScreen';
import ScoreHistoryScreen from '../screens/ScoreHistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import {ResumeAnalysisRecord} from '../types/resume';

// --- Stack Param Lists ---
export type HomeStackParamList = {
  DashboardMain: undefined;
  CVScoreResult: {analysis: ResumeAnalysisRecord};
};

export type AnalyzeStackParamList = {
  CVUploadMain: undefined;
  CVScoreResult: {analysis: ResumeAnalysisRecord};
};

export type HistoryStackParamList = {
  ScoreHistoryMain: undefined;
  CVScoreResult: {analysis: ResumeAnalysisRecord};
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
};

// --- Stack Navigators ---
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const AnalyzeStack = createNativeStackNavigator<AnalyzeStackParamList>();
const HistoryStack = createNativeStackNavigator<HistoryStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

// --- Bottom Tabs ---
const Tab = createBottomTabNavigator();

// --- Session Context to pass session stably to screens ---
const SessionContext = React.createContext<Session | null>(null);
export const useSession = () => React.useContext(SessionContext);

// --- Screen Wrappers with stable references ---
const DashboardScreenWrapper = (props: any) => {
  const session = useSession();
  return <DashboardScreen {...props} session={session!} />;
};

const CVUploadScreenWrapper = (props: any) => {
  const session = useSession();
  return <CVUploadScreen {...props} session={session!} />;
};

const ScoreHistoryScreenWrapper = (props: any) => {
  const session = useSession();
  return <ScoreHistoryScreen {...props} session={session!} />;
};

const ProfileScreenWrapper = (props: any) => {
  const session = useSession();
  return <ProfileScreen {...props} session={session!} />;
};

// --- Tab Stack Screens as stable component definitions ---
const HomeTabScreen = () => {
  const {colors} = useTheme();
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: {backgroundColor: colors.bgDark},
      }}>
      <HomeStack.Screen name="DashboardMain" component={DashboardScreenWrapper} />
      <HomeStack.Screen name="CVScoreResult" component={CVScoreResultScreen} />
    </HomeStack.Navigator>
  );
};

const AnalyzeTabScreen = () => {
  const {colors} = useTheme();
  return (
    <AnalyzeStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: {backgroundColor: colors.bgDark},
      }}>
      <AnalyzeStack.Screen name="CVUploadMain" component={CVUploadScreenWrapper} />
      <AnalyzeStack.Screen name="CVScoreResult" component={CVScoreResultScreen} />
    </AnalyzeStack.Navigator>
  );
};

const HistoryTabScreen = () => {
  const {colors} = useTheme();
  return (
    <HistoryStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: {backgroundColor: colors.bgDark},
      }}>
      <HistoryStack.Screen name="ScoreHistoryMain" component={ScoreHistoryScreenWrapper} />
      <HistoryStack.Screen name="CVScoreResult" component={CVScoreResultScreen} />
    </HistoryStack.Navigator>
  );
};

const ProfileTabScreen = () => {
  const {colors} = useTheme();
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: {backgroundColor: colors.bgDark},
      }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreenWrapper} />
    </ProfileStack.Navigator>
  );
};

interface BottomTabNavigatorProps {
  session: Session;
}

const BottomTabNavigator: React.FC<BottomTabNavigatorProps> = ({session}) => {
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <SessionContext.Provider value={session}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.bgCard,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: 6,
            elevation: isDark ? 0 : 8,
            shadowColor: colors.cardShadow,
            shadowOffset: {width: 0, height: -2},
            shadowOpacity: isDark ? 0 : 0.08,
            shadowRadius: 8,
            height: TAB_BAR.height + bottomPadding,
            paddingBottom: bottomPadding,
          },
          tabBarActiveTintColor: colors.primaryStart,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: styles.tabLabel,
          tabBarItemStyle: styles.tabItem,
          tabBarHideOnKeyboard: true,
        }}>
        <Tab.Screen
          name="HomeTab"
          component={HomeTabScreen}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({focused, color}) => (
              <Icon
                name={focused ? 'home' : 'home-outline'}
                size={TAB_BAR.iconSize}
                color={color}
              />
            ),
          }}
        />

        <Tab.Screen
          name="AnalyzeTab"
          component={AnalyzeTabScreen}
          options={{
            tabBarLabel: 'Analyze',
            tabBarIcon: ({focused, color}) => (
              <Icon
                name={focused ? 'document-text' : 'document-text-outline'}
                size={TAB_BAR.iconSize}
                color={color}
              />
            ),
          }}
        />

        <Tab.Screen
          name="HistoryTab"
          component={HistoryTabScreen}
          options={{
            tabBarLabel: 'History',
            tabBarIcon: ({focused, color}) => (
              <Icon
                name={focused ? 'time' : 'time-outline'}
                size={TAB_BAR.iconSize}
                color={color}
              />
            ),
          }}
        />

        <Tab.Screen
          name="ProfileTab"
          component={ProfileTabScreen}
          options={{
            tabBarLabel: 'Profile',
            tabBarIcon: ({focused, color}) => (
              <Icon
                name={focused ? 'person' : 'person-outline'}
                size={TAB_BAR.iconSize}
                color={color}
              />
            ),
          }}
        />
      </Tab.Navigator>
    </SessionContext.Provider>
  );
};

const styles = StyleSheet.create({
  tabLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: TAB_BAR.labelSize,
    marginTop: 2,
  },
  tabItem: {
    paddingTop: 4,
  },
});

export default BottomTabNavigator;
