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
import InterviewSetupScreen from '../screens/InterviewSetupScreen';
import InterviewRecordingScreen from '../screens/InterviewRecordingScreen';
import InterviewResultScreen from '../screens/InterviewResultScreen';
import {ResumeAnalysisRecord} from '../types/resume';
import {ExperienceLevel, InterviewMode, InterviewSessionRecord} from '../types/interview';
import {InterviewAttempt} from '../types/interviewCoach';
import {PitchNotes, PersonalPitch} from '../types/pitchTrainer';

// New Interview Coach screens
import InterviewCoachScreenV2 from '../screens/interviewCoach/InterviewCoachScreenV2';
import InterviewSessionScreen from '../screens/interviewCoach/InterviewSessionScreen';
import InterviewFeedbackScreen from '../screens/interviewCoach/InterviewFeedbackScreen';
import InterviewCoachResultScreen from '../screens/interviewCoach/InterviewResultScreen';

// New Personal Pitch Trainer screens
import PersonalPitchTrainerScreen from '../screens/pitchTrainer/PersonalPitchTrainerScreen';
import PitchTrainerCreateScreen from '../screens/pitchTrainer/PitchTrainerCreateScreen';
import PitchTrainerRecordScreen from '../screens/pitchTrainer/PitchTrainerRecordScreen';
import PitchTrainerFeedbackScreen from '../screens/pitchTrainer/PitchTrainerFeedbackScreen';

// --- Stack Param Lists ---
export type HomeStackParamList = {
  DashboardMain: undefined;
  CVScoreResult: {analysis: ResumeAnalysisRecord};
  InterviewSetup: undefined;
  InterviewRecording: {
    experienceLevel: ExperienceLevel;
    recordingMode: InterviewMode;
    targetRole: string;
  };
  InterviewResult: {analysis: InterviewSessionRecord};
  // Interview Coach routes
  InterviewCoach: {resumeOngoingFromMenu?: boolean} | undefined;
  InterviewSession: {journeyId: string; jobRole: string; isFirstTimeJobRole?: boolean};
  InterviewFeedback: {journeyId: string; roundNumber: number; attempt: InterviewAttempt; jobRole: string};
  InterviewCoachResult: {journeyId: string; roundNumber?: number; jobRole: string};
  // Pitch Trainer routes
  PitchTrainerMain: undefined;
  PitchTrainerCreate: {
    language?: string;
    returnToRecord?: boolean;
    existingPitchId?: string;
    initialJobRole?: string;
    initialNotes?: PitchNotes;
  } | undefined;
  PitchTrainerRecord: {
    pitchId: string;
    jobRole: string;
    notes: PitchNotes;
    language: string;
  };
  PitchTrainerFeedback: {
    pitchId: string;
    jobRole: string;
    isView?: boolean;
    initialPitch?: PersonalPitch;
  };
};

export type AnalyzeStackParamList = {
  CVUploadMain: undefined;
  CVScoreResult: {analysis: ResumeAnalysisRecord};
  InterviewSetup: undefined;
  InterviewRecording: {
    experienceLevel: ExperienceLevel;
    recordingMode: InterviewMode;
    targetRole: string;
  };
  InterviewResult: {analysis: InterviewSessionRecord};
  // Interview Coach routes
  InterviewCoach: {resumeOngoingFromMenu?: boolean} | undefined;
  InterviewSession: {journeyId: string; jobRole: string; isFirstTimeJobRole?: boolean};
  InterviewFeedback: {journeyId: string; roundNumber: number; attempt: InterviewAttempt; jobRole: string};
  InterviewCoachResult: {journeyId: string; roundNumber?: number; jobRole: string};
  // Pitch Trainer routes
  PitchTrainerMain: undefined;
  PitchTrainerCreate: {
    language?: string;
    returnToRecord?: boolean;
    existingPitchId?: string;
    initialJobRole?: string;
    initialNotes?: PitchNotes;
  } | undefined;
  PitchTrainerRecord: {
    pitchId: string;
    jobRole: string;
    notes: PitchNotes;
    language: string;
  };
  PitchTrainerFeedback: {
    pitchId: string;
    jobRole: string;
    isView?: boolean;
    initialPitch?: PersonalPitch;
  };
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

const InterviewRecordingScreenWrapper = (props: any) => {
  const session = useSession();
  return <InterviewRecordingScreen {...props} session={session!} />;
};

const InterviewCoachScreenV2Wrapper = (props: any) => {
  const session = useSession();
  return <InterviewCoachScreenV2 {...props} session={session!} />;
};

const InterviewSessionScreenWrapper = (props: any) => {
  const session = useSession();
  return <InterviewSessionScreen {...props} session={session!} />;
};

const PersonalPitchTrainerScreenWrapper = (props: any) => {
  const session = useSession();
  return <PersonalPitchTrainerScreen {...props} session={session!} />;
};

const PitchTrainerCreateScreenWrapper = (props: any) => {
  const session = useSession();
  return <PitchTrainerCreateScreen {...props} session={session!} />;
};

const PitchTrainerRecordScreenWrapper = (props: any) => {
  const session = useSession();
  return <PitchTrainerRecordScreen {...props} session={session!} />;
};

const PitchTrainerFeedbackScreenWrapper = (props: any) => {
  const session = useSession();
  return <PitchTrainerFeedbackScreen {...props} session={session!} />;
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
      <HomeStack.Screen name="InterviewSetup" component={InterviewSetupScreen} />
      <HomeStack.Screen name="InterviewRecording" component={InterviewRecordingScreenWrapper} />
      <HomeStack.Screen name="InterviewResult" component={InterviewResultScreen} />
      {/* Interview Coach screens */}
      <HomeStack.Screen name="InterviewCoach" component={InterviewCoachScreenV2Wrapper} />
      <HomeStack.Screen name="InterviewSession" component={InterviewSessionScreenWrapper} />
      <HomeStack.Screen name="InterviewFeedback" component={InterviewFeedbackScreen} />
      <HomeStack.Screen name="InterviewCoachResult" component={InterviewCoachResultScreen} />
      {/* Personal Pitch Trainer screens */}
      <HomeStack.Screen name="PitchTrainerMain" component={PersonalPitchTrainerScreenWrapper} />
      <HomeStack.Screen name="PitchTrainerCreate" component={PitchTrainerCreateScreenWrapper} />
      <HomeStack.Screen name="PitchTrainerRecord" component={PitchTrainerRecordScreenWrapper} />
      <HomeStack.Screen name="PitchTrainerFeedback" component={PitchTrainerFeedbackScreenWrapper} />
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
      <AnalyzeStack.Screen name="InterviewSetup" component={InterviewSetupScreen} />
      <AnalyzeStack.Screen name="InterviewRecording" component={InterviewRecordingScreenWrapper} />
      <AnalyzeStack.Screen name="InterviewResult" component={InterviewResultScreen} />
      {/* Interview Coach screens */}
      <AnalyzeStack.Screen name="InterviewCoach" component={InterviewCoachScreenV2Wrapper} />
      <AnalyzeStack.Screen name="InterviewSession" component={InterviewSessionScreenWrapper} />
      <AnalyzeStack.Screen name="InterviewFeedback" component={InterviewFeedbackScreen} />
      <AnalyzeStack.Screen name="InterviewCoachResult" component={InterviewCoachResultScreen} />
      {/* Personal Pitch Trainer screens */}
      <AnalyzeStack.Screen name="PitchTrainerMain" component={PersonalPitchTrainerScreenWrapper} />
      <AnalyzeStack.Screen name="PitchTrainerCreate" component={PitchTrainerCreateScreenWrapper} />
      <AnalyzeStack.Screen name="PitchTrainerRecord" component={PitchTrainerRecordScreenWrapper} />
      <AnalyzeStack.Screen name="PitchTrainerFeedback" component={PitchTrainerFeedbackScreenWrapper} />
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
