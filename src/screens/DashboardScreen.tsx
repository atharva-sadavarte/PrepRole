import React, {useRef, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  ScrollView,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {supabase} from '../lib/supabase';
import {COLORS, SPACING, RADIUS} from '../lib/theme';
import {getUserAnalyses} from '../services/resumeService';
import {ResumeAnalysisRecord} from '../types/resume';
import type {Session} from '@supabase/supabase-js';

const {width} = Dimensions.get('window');

interface DashboardScreenProps {
  session: Session;
  navigation: any;
}

const DashboardScreen = ({session, navigation}: DashboardScreenProps) => {
  const [recentScans, setRecentScans] = useState<ResumeAnalysisRecord[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const cardAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const user = session.user;
  const userName =
    user.user_metadata?.full_name || user.user_metadata?.name || 'User';
  const userAvatar = user.user_metadata?.avatar_url;
  const userEmail = user.email;

  useEffect(() => {
    const fetchScans = async () => {
      try {
        const scans = await getUserAnalyses(session.user.id);
        setRecentScans(scans.slice(0, 3));
      } catch (err) {
        console.error('Error fetching dashboard scans:', err);
      }
    };
    fetchScans();

    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      Animated.stagger(
        120,
        cardAnims.map(anim =>
          Animated.spring(anim, {
            toValue: 1,
            tension: 50,
            friction: 8,
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start();
  }, [session.user.id, fadeAnim, slideAnim, cardAnims]);

  const handleSignOut = async () => {
    try {
      await GoogleSignin.signOut();
    } catch {
      // Google sign out may fail if not signed in via Google
    }
    await supabase.auth.signOut();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const handleActionPress = (index: number) => {
    if (index === 0) {
      // Upload CV
      navigation.navigate('CVUpload');
    } else if (index === 2) {
      // My Scores
      navigation.navigate('ScoreHistory');
    } else if (index === 1) {
      // Mock Interview
      navigation.navigate('CVUpload');
    } else {
      navigation.navigate('ScoreHistory');
    }
  };

  const quickActions = [
    {
      icon: '📄',
      title: 'Upload CV',
      desc: 'Scan & score your resume',
      gradient: ['#6C63FF', '#4834DF'],
    },
    {
      icon: '💬',
      title: 'Mock Interview',
      desc: 'Practice with AI',
      gradient: ['#00D2FF', '#0096C7'],
    },
    {
      icon: '📊',
      title: 'My Scores',
      desc: 'View past results',
      gradient: ['#00E676', '#00C853'],
    },
    {
      icon: '🎓',
      title: 'Learning',
      desc: 'Improve your skills',
      gradient: ['#FFD600', '#FFAB00'],
    },
  ];

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[COLORS.bgDark, '#0F1329', '#141833']}
        style={styles.gradient}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <Animated.View
            style={[
              styles.header,
              {opacity: fadeAnim, transform: [{translateY: slideAnim}]},
            ]}>
            <View style={styles.headerTop}>
              <View style={styles.headerLeft}>
                <Text style={styles.greeting}>{getGreeting()} 👋</Text>
                <Text style={styles.userName} numberOfLines={1}>
                  {userName.split(' ')[0]}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleSignOut}
                style={styles.avatarContainer}>
                {userAvatar ? (
                  <Image source={{uri: userAvatar}} style={styles.avatar} />
                ) : (
                  <LinearGradient
                    colors={[COLORS.primaryStart, COLORS.primaryEnd]}
                    style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {userName.charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                )}
              </TouchableOpacity>
            </View>

            {/* Stats Hero Card */}
            <LinearGradient
              colors={[COLORS.primaryStart, COLORS.primaryEnd]}
              style={styles.statsCard}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}>
              <View style={styles.statsOverlay}>
                <View style={styles.statsContent}>
                  <Text style={styles.statsTitle}>Ready to level up?</Text>
                  <Text style={styles.statsSubtitle}>
                    Upload your CV and get an AI score & actionable recommendations
                  </Text>
                  <TouchableOpacity
                    style={styles.statsButton}
                    onPress={() => navigation.navigate('CVUpload')}>
                    <Text style={styles.statsButtonText}>Scan My CV →</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.statsBigEmoji}>🚀</Text>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              {quickActions.map((action, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.actionCardWrapper,
                    {
                      opacity: cardAnims[index],
                      transform: [
                        {
                          scale: cardAnims[index].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.8, 1],
                          }),
                        },
                      ],
                    },
                  ]}>
                  <TouchableOpacity
                    style={styles.actionCard}
                    activeOpacity={0.8}
                    onPress={() => handleActionPress(index)}>
                    <LinearGradient
                      colors={action.gradient}
                      style={styles.actionIconBg}
                      start={{x: 0, y: 0}}
                      end={{x: 1, y: 1}}>
                      <Text style={styles.actionEmoji}>{action.icon}</Text>
                    </LinearGradient>
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    <Text style={styles.actionDesc}>{action.desc}</Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </View>

          {/* Recent Activity */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              {recentScans.length > 0 && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('ScoreHistory')}>
                  <Text style={styles.seeAllText}>See All →</Text>
                </TouchableOpacity>
              )}
            </View>

            {recentScans.length > 0 ? (
              recentScans.map(scan => (
                <TouchableOpacity
                  key={scan.id}
                  style={styles.activityItem}
                  activeOpacity={0.8}
                  onPress={() =>
                    navigation.navigate('CVScoreResult', {analysis: scan})
                  }>
                  <View style={styles.activityScoreBadge}>
                    <Text style={styles.activityScoreText}>
                      {scan.overall_score}
                    </Text>
                  </View>
                  <View style={styles.activityText}>
                    <Text style={styles.activityTitle} numberOfLines={1}>
                      {scan.target_role}
                    </Text>
                    <Text style={styles.activityDesc} numberOfLines={1}>
                      {scan.score_tier} • {scan.improvements?.length || 0}{' '}
                      recommendations
                    </Text>
                  </View>
                  <Text style={styles.activityTime}>
                    {formatDate(scan.created_at)}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <TouchableOpacity
                style={styles.activityItem}
                onPress={() => navigation.navigate('CVUpload')}>
                <View style={styles.activityIcon}>
                  <Text style={styles.activityEmoji}>🔥</Text>
                </View>
                <View style={styles.activityText}>
                  <Text style={styles.activityTitle}>No CV analyzed yet</Text>
                  <Text style={styles.activityDesc}>
                    Upload your first CV to get scored!
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Profile info */}
          <View style={[styles.section, styles.profileSection]}>
            <View style={styles.profileInfo}>
              <Text style={styles.profileLabel}>Signed in as</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {userEmail}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleSignOut}
              style={styles.signOutButton}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl + SPACING.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  avatarContainer: {
    marginLeft: SPACING.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.primaryStart,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statsCard: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    shadowColor: COLORS.primaryStart,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  statsOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  statsContent: {
    flex: 1,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  statsSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 19,
    marginBottom: SPACING.md,
  },
  statsButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  statsButtonText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  statsBigEmoji: {
    fontSize: 56,
    marginLeft: SPACING.md,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  seeAllText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  actionCardWrapper: {
    width: (width - SPACING.lg * 2 - SPACING.md) / 2,
  },
  actionCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionIconBg: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  actionEmoji: {
    fontSize: 22,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  activityIcon: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCardLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityEmoji: {
    fontSize: 20,
  },
  activityScoreBadge: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(0, 210, 255, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityScoreText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.accent,
  },
  activityText: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  activityDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  activityTime: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  profileSection: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  profileInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  profileLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  signOutButton: {
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.3)',
  },
  signOutText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.error,
  },
});

export default DashboardScreen;
