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
import {useTheme} from '../context/ThemeContext';
import {COLORS, SPACING, RADIUS, ICON_SIZES, FONTS} from '../lib/theme';
import {getUserAnalyses} from '../services/resumeService';
import {ResumeAnalysisRecord} from '../types/resume';
import Icon from '../components/Icon';
import type {Session} from '@supabase/supabase-js';

const {width} = Dimensions.get('window');

interface DashboardScreenProps {
  session: Session;
  navigation: any;
}

const DashboardScreen = ({session, navigation}: DashboardScreenProps) => {
  const {colors, isDark} = useTheme();
  const [recentScans, setRecentScans] = useState<ResumeAnalysisRecord[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
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
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
      ]),
      Animated.stagger(
        90,
        cardAnims.map(anim =>
          Animated.spring(anim, {
            toValue: 1,
            tension: 55,
            friction: 8,
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start();
  }, [session.user.id, fadeAnim, slideAnim, cardAnims]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const todayFormatted = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const bestScore =
    recentScans.length > 0
      ? Math.max(...recentScans.map(s => s.overall_score || 0))
      : 0;

  const handleActionPress = (key: 'analyze' | 'interview' | 'history' | 'learning') => {
    if (key === 'analyze') {
      navigation
        .getParent()
        ?.navigate('AnalyzeTab', {screen: 'CVUploadMain'});
    } else if (key === 'history') {
      navigation
        .getParent()
        ?.navigate('HistoryTab', {screen: 'ScoreHistoryMain'});
    } else if (key === 'interview') {
      navigation
        .getParent()
        ?.navigate('AnalyzeTab', {screen: 'CVUploadMain'});
    } else {
      navigation
        .getParent()
        ?.navigate('HistoryTab', {screen: 'ScoreHistoryMain'});
    }
  };

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
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={[colors.bgDark, colors.gradientMiddle, colors.gradientEnd]}
        style={styles.gradient}>
        {/* Fixed Top Brand & Profile Header Bar */}
        <View
          style={[
            styles.fixedHeader,
            {
              backgroundColor: colors.bgDark,
              borderBottomColor: colors.border,
            },
          ]}>
          <View style={styles.headerTopBar}>
            {/* Brand Pill */}
            <View
              style={[
                styles.brandPill,
                {
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                  shadowColor: colors.cardShadow,
                },
              ]}>
              <View
                style={[
                  styles.sparkleIconWrapper,
                  {backgroundColor: colors.accentSoft},
                ]}>
                <Icon name="sparkles" size={12} color={colors.accent} />
              </View>
              <Text style={[styles.brandPillText, {color: colors.textPrimary}]}>
                PrepRole AI
              </Text>
              <View
                style={[
                  styles.activeBadgePill,
                  {backgroundColor: colors.accentSoft},
                ]}>
                <Text style={[styles.activeBadgeText, {color: colors.accent}]}>
                  PRO
                </Text>
              </View>
            </View>

            {/* Profile Avatar / Quick Nav */}
            <TouchableOpacity
              onPress={() => navigation.getParent()?.navigate('ProfileTab')}
              activeOpacity={0.8}
              style={styles.avatarTouchArea}>
              <View
                style={[
                  styles.avatarRing,
                  {
                    borderColor: colors.accent,
                    backgroundColor: colors.bgCard,
                    shadowColor: colors.cardShadow,
                  },
                ]}>
                {userAvatar ? (
                  <Image source={{uri: userAvatar}} style={styles.avatarImage} />
                ) : (
                  <LinearGradient
                    colors={[colors.primaryStart, colors.primaryEnd]}
                    style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>
                      {userName.charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                )}
              </View>
              <View style={[styles.onlineDot, {borderColor: colors.bgDark}]} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          {/* Main Content Animation Wrapper */}
          <Animated.View
            style={[
              styles.contentHeader,
              {opacity: fadeAnim, transform: [{translateY: slideAnim}]},
            ]}>
            {/* Editorial Greeting */}
            <View style={styles.greetingWrapper}>
              <View style={styles.greetingSubRow}>
                <Text style={[styles.greetingLabel, {color: colors.accent}]}>
                  {getGreeting().toUpperCase()}
                </Text>
                <Text style={[styles.dateSeparator, {color: colors.textMuted}]}>
                  •
                </Text>
                <Text style={[styles.dateText, {color: colors.textSecondary}]}>
                  {todayFormatted}
                </Text>
              </View>
              <Text
                style={[styles.userNameHeadline, {color: colors.textPrimary}]}
                numberOfLines={1}>
                {userName}
              </Text>
              <Text style={[styles.headlineSub, {color: colors.textSecondary}]}>
                Your career readiness & ATS optimization hub
              </Text>
            </View>

            {/* Executive 3-Metric Strip */}
            <View style={styles.metricsRow}>
              {/* Metric 1: Best Score */}
              <View
                style={[
                  styles.metricCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    shadowColor: colors.cardShadow,
                  },
                ]}>
                <View
                  style={[
                    styles.metricIconBg,
                    {backgroundColor: colors.accentSoft},
                  ]}>
                  <Icon name="trophy-outline" size={16} color={colors.accent} />
                </View>
                <Text style={[styles.metricValue, {color: colors.textPrimary}]}>
                  {bestScore > 0 ? `${bestScore}` : '—'}
                </Text>
                <Text style={[styles.metricLabel, {color: colors.textSecondary}]}>
                  Best Score
                </Text>
              </View>

              {/* Metric 2: Total Scans */}
              <View
                style={[
                  styles.metricCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    shadowColor: colors.cardShadow,
                  },
                ]}>
                <View
                  style={[
                    styles.metricIconBg,
                    {backgroundColor: 'rgba(91, 130, 102, 0.14)'},
                  ]}
                >
                  <Icon name="document-text-outline" size={16} color="#5B8266" />
                </View>
                <Text style={[styles.metricValue, {color: colors.textPrimary}]}>
                  {recentScans.length}
                </Text>
                <Text style={[styles.metricLabel, {color: colors.textSecondary}]}>
                  Scans Done
                </Text>
              </View>

              {/* Metric 3: Target Role / Tier */}
              <View
                style={[
                  styles.metricCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    shadowColor: colors.cardShadow,
                  },
                ]}>
                <View
                  style={[
                    styles.metricIconBg,
                    {backgroundColor: 'rgba(217, 130, 43, 0.14)'},
                  ]}>
                  <Icon name="diamond-outline" size={16} color="#D9822B" />
                </View>
                <Text style={[styles.metricValue, {color: colors.textPrimary}]}>
                  Free
                </Text>
                <Text style={[styles.metricLabel, {color: colors.textSecondary}]}>
                  Plan Level
                </Text>
              </View>
            </View>

            {/* Spotlight Banner Card */}
            <View
              style={[
                styles.spotlightCard,
                {
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                  shadowColor: colors.cardShadow,
                },
              ]}>
              <View style={styles.spotlightHeaderRow}>
                <View
                  style={[
                    styles.spotlightTag,
                    {backgroundColor: colors.accentSoft},
                  ]}>
                  <Icon
                    name="flash"
                    size={11}
                    color={colors.accent}
                    style={{marginRight: 4}}
                  />
                  <Text style={[styles.spotlightTagText, {color: colors.accent}]}>
                    AI CV OPTIMIZER
                  </Text>
                </View>
                <Text style={[styles.spotlightVersion, {color: colors.textMuted}]}>
                  ATS v2.4
                </Text>
              </View>

              <Text
                style={[styles.spotlightTitle, {color: colors.textPrimary}]}>
                Benchmark Your Resume Against ATS Standards
              </Text>
              <Text
                style={[styles.spotlightDesc, {color: colors.textSecondary}]}>
                Get instant 5-pillar scoring, keyword gap diagnostics, and
                personalized bullet rewrites to beat the filter.
              </Text>

              {/* Dual Action Buttons */}
              <View style={styles.spotlightActionsRow}>
                <TouchableOpacity
                  style={[
                    styles.primaryCtaBtn,
                    {backgroundColor: colors.primaryStart},
                  ]}
                  activeOpacity={0.85}
                  onPress={() => handleActionPress('analyze')}>
                  <Text style={styles.primaryCtaText} numberOfLines={1}>
                    Scan Resume
                  </Text>
                  <Icon
                    name="arrow-forward"
                    size={14}
                    color="#FFFFFF"
                    style={{marginLeft: 6}}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.secondaryCtaBtn,
                    {
                      backgroundColor: colors.bgCardLight,
                      borderColor: colors.border,
                    },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleActionPress('history')}>
                  <Icon
                    name="time-outline"
                    size={14}
                    color={colors.textSecondary}
                    style={{marginRight: 5}}
                  />
                  <Text
                    style={[
                      styles.secondaryCtaText,
                      {color: colors.textSecondary},
                    ]}
                    numberOfLines={1}>
                    History
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* Tools & Accelerators Section */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionHeading, {color: colors.textPrimary}]}>
                Career Tools
              </Text>
              <Text style={[styles.sectionSubheading, {color: colors.textSecondary}]}>
                AI-assisted interview & resume suite
              </Text>
            </View>

            {/* Featured Wide Action Card */}
            <Animated.View
              style={{
                opacity: cardAnims[0],
                transform: [
                  {
                    translateY: cardAnims[0].interpolate({
                      inputRange: [0, 1],
                      outputRange: [15, 0],
                    }),
                  },
                ],
              }}>
              <TouchableOpacity
                style={[
                  styles.wideFeaturedCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    shadowColor: colors.cardShadow,
                  },
                ]}
                activeOpacity={0.85}
                onPress={() => handleActionPress('analyze')}>
                <LinearGradient
                  colors={[colors.accent, colors.primaryEnd]}
                  style={styles.featuredIconBg}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}>
                  <Icon name="document-text" size={22} color="#FFFFFF" />
                </LinearGradient>
                <View style={styles.featuredCardContent}>
                  <View style={styles.featuredBadgeRow}>
                    <Text
                      style={[
                        styles.featuredCardTitle,
                        {color: colors.textPrimary},
                      ]}>
                      Scan & Score CV
                    </Text>
                    <View
                      style={[
                        styles.miniBadge,
                        {backgroundColor: colors.accentSoft},
                      ]}>
                      <Text
                        style={[styles.miniBadgeText, {color: colors.accent}]}>
                        Popular
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.featuredCardDesc,
                      {color: colors.textSecondary},
                    ]}>
                    Analyze resume against specific job descriptions for match rate
                  </Text>
                </View>
                <Icon
                  name="chevron-forward"
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </Animated.View>

            {/* Companion Row: Mock Interview & Score History */}
            <View style={styles.splitRow}>
              {/* Mock Interview */}
              <Animated.View
                style={[
                  styles.splitCol,
                  {
                    opacity: cardAnims[1],
                    transform: [
                      {
                        translateY: cardAnims[1].interpolate({
                          inputRange: [0, 1],
                          outputRange: [15, 0],
                        }),
                      },
                    ],
                  },
                ]}>
                <TouchableOpacity
                  style={[
                    styles.compactActionCard,
                    {
                      backgroundColor: colors.bgCard,
                      borderColor: colors.border,
                      shadowColor: colors.cardShadow,
                    },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => handleActionPress('interview')}>
                  <LinearGradient
                    colors={['#5B8266', '#4A7C59']}
                    style={styles.compactIconBg}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 1}}>
                    <Icon name="chatbubbles" size={18} color="#FFFFFF" />
                  </LinearGradient>
                  <Text
                    style={[
                      styles.compactCardTitle,
                      {color: colors.textPrimary},
                    ]}>
                    Mock Interview
                  </Text>
                  <Text
                    style={[
                      styles.compactCardDesc,
                      {color: colors.textSecondary},
                    ]}>
                    Practice AI drills
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              {/* Score History */}
              <Animated.View
                style={[
                  styles.splitCol,
                  {
                    opacity: cardAnims[2],
                    transform: [
                      {
                        translateY: cardAnims[2].interpolate({
                          inputRange: [0, 1],
                          outputRange: [15, 0],
                        }),
                      },
                    ],
                  },
                ]}>
                <TouchableOpacity
                  style={[
                    styles.compactActionCard,
                    {
                      backgroundColor: colors.bgCard,
                      borderColor: colors.border,
                      shadowColor: colors.cardShadow,
                    },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => handleActionPress('history')}>
                  <LinearGradient
                    colors={['#C25953', '#A84842']}
                    style={styles.compactIconBg}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 1}}>
                    <Icon name="bar-chart" size={18} color="#FFFFFF" />
                  </LinearGradient>
                  <Text
                    style={[
                      styles.compactCardTitle,
                      {color: colors.textPrimary},
                    ]}>
                    Score Archive
                  </Text>
                  <Text
                    style={[
                      styles.compactCardDesc,
                      {color: colors.textSecondary},
                    ]}>
                    View past reports
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>

            {/* Learning Card */}
            <Animated.View
              style={{
                opacity: cardAnims[3],
                transform: [
                  {
                    translateY: cardAnims[3].interpolate({
                      inputRange: [0, 1],
                      outputRange: [15, 0],
                    }),
                  },
                ],
              }}>
              <TouchableOpacity
                style={[
                  styles.learningBannerCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    shadowColor: colors.cardShadow,
                  },
                ]}
                activeOpacity={0.85}
                onPress={() => handleActionPress('learning')}>
                <LinearGradient
                  colors={['#C27322', '#A35D16']}
                  style={styles.compactIconBg}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}>
                  <Icon name="school" size={18} color="#FFFFFF" />
                </LinearGradient>
                <View style={{flex: 1, marginLeft: SPACING.md}}>
                  <Text
                    style={[
                      styles.compactCardTitle,
                      {color: colors.textPrimary},
                    ]}>
                    Skill Growth & Playbook
                  </Text>
                  <Text
                    style={[
                      styles.compactCardDesc,
                      {color: colors.textSecondary},
                    ]}>
                    Actionable strategies to boost your resume callbacks
                  </Text>
                </View>
                <Icon
                  name="chevron-forward"
                  size={16}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Recent Activity Section */}
          <View style={styles.section}>
            <View style={styles.activityHeaderRow}>
              <View>
                <Text
                  style={[styles.sectionHeading, {color: colors.textPrimary}]}>
                  Recent Activity
                </Text>
                <Text
                  style={[
                    styles.sectionSubheading,
                    {color: colors.textSecondary},
                  ]}>
                  Your latest resume evaluations
                </Text>
              </View>
              {recentScans.length > 0 && (
                <TouchableOpacity
                  onPress={() => handleActionPress('history')}
                  style={styles.seeAllBtn}>
                  <Text
                    style={[styles.seeAllText, {color: colors.accent}]}>
                    View All
                  </Text>
                  <Icon
                    name="chevron-forward"
                    size={13}
                    color={colors.accent}
                  />
                </TouchableOpacity>
              )}
            </View>

            {recentScans.length > 0 ? (
              recentScans.map(scan => (
                <TouchableOpacity
                  key={scan.id}
                  style={[
                    styles.activityItem,
                    {
                      backgroundColor: colors.bgCard,
                      borderColor: colors.border,
                      shadowColor: colors.cardShadow,
                    },
                  ]}
                  activeOpacity={0.8}
                  onPress={() =>
                    navigation.navigate('CVScoreResult', {analysis: scan})
                  }>
                  <View
                    style={[
                      styles.activityScoreBadge,
                      {
                        backgroundColor: colors.accentSoft,
                        borderColor: colors.border,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.activityScoreText,
                        {color: colors.accent},
                      ]}>
                      {scan.overall_score}
                    </Text>
                  </View>
                  <View style={styles.activityText}>
                    <Text
                      style={[
                        styles.activityTitle,
                        {color: colors.textPrimary},
                      ]}
                      numberOfLines={1}>
                      {scan.target_role}
                    </Text>
                    <Text
                      style={[
                        styles.activityDesc,
                        {color: colors.textSecondary},
                      ]}
                      numberOfLines={1}>
                      {scan.summary || 'Resume analyzed successfully'}
                    </Text>
                  </View>
                  <View style={styles.activityRight}>
                    <Text
                      style={[
                        styles.activityTime,
                        {color: colors.textMuted},
                      ]}>
                      {formatDate(scan.created_at)}
                    </Text>
                    <Icon
                      name="chevron-forward"
                      size={15}
                      color={colors.textMuted}
                    />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <TouchableOpacity
                style={[
                  styles.emptyActivityCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    shadowColor: colors.cardShadow,
                  },
                ]}
                activeOpacity={0.85}
                onPress={() => handleActionPress('analyze')}>
                <View
                  style={[
                    styles.emptyIconCircle,
                    {backgroundColor: colors.accentSoft},
                  ]}>
                  <Icon
                    name="document-text-outline"
                    size={22}
                    color={colors.accent}
                  />
                </View>
                <View style={{flex: 1, marginLeft: SPACING.md}}>
                  <Text
                    style={[
                      styles.emptyCardTitle,
                      {color: colors.textPrimary},
                    ]}>
                    No CV Scans Yet
                  </Text>
                  <Text
                    style={[
                      styles.emptyCardDesc,
                      {color: colors.textSecondary},
                    ]}>
                    Scan your resume to view your ATS score timeline
                  </Text>
                </View>
                <Icon
                  name="arrow-forward"
                  size={16}
                  color={colors.accent}
                />
              </TouchableOpacity>
            )}
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
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl + 20,
  },
  fixedHeader: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl + 8,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  contentHeader: {
    paddingHorizontal: SPACING.lg,
  },
  headerTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  sparkleIconWrapper: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  brandPillText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    letterSpacing: 0.3,
    marginRight: 6,
  },
  activeBadgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  activeBadgeText: {
    fontFamily: FONTS.extraBold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  avatarTouchArea: {
    position: 'relative',
  },
  avatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 3,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#5B8266',
    borderWidth: 2,
  },
  greetingWrapper: {
    marginBottom: SPACING.lg,
  },
  greetingSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  greetingLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  dateSeparator: {
    fontFamily: FONTS.medium,
    marginHorizontal: 6,
    fontSize: 12,
  },
  dateText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  userNameHeadline: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  headlineSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  metricCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  metricIconBg: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  metricLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
  },
  spotlightCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    elevation: 3,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  spotlightHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  spotlightTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  spotlightTagText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  spotlightVersion: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
  spotlightTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    letterSpacing: -0.3,
    lineHeight: 24,
    marginBottom: 6,
  },
  spotlightDesc: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  spotlightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  primaryCtaBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADIUS.full,
  },
  primaryCtaText: {
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    fontSize: 13,
    letterSpacing: 0.2,
  },
  secondaryCtaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  secondaryCtaText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },
  sectionTitleRow: {
    marginBottom: SPACING.md,
  },
  sectionHeading: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  sectionSubheading: {
    fontFamily: FONTS.regular,
    fontSize: 12,
  },
  wideFeaturedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    marginBottom: SPACING.sm,
  },
  featuredIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredCardContent: {
    flex: 1,
    marginLeft: SPACING.md,
    marginRight: SPACING.xs,
  },
  featuredBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  featuredCardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    marginRight: 6,
  },
  miniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  miniBadgeText: {
    fontFamily: FONTS.extraBold,
    fontSize: 9,
    letterSpacing: 0.4,
  },
  featuredCardDesc: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    lineHeight: 15,
  },
  splitRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  splitCol: {
    flex: 1,
  },
  compactActionCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  compactIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  compactCardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    marginBottom: 2,
  },
  compactCardDesc: {
    fontFamily: FONTS.regular,
    fontSize: 11,
  },
  learningBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  activityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: SPACING.md,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingBottom: 2,
  },
  seeAllText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    elevation: 2,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  activityScoreBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityScoreText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
  },
  activityText: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  activityTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    marginBottom: 2,
  },
  activityDesc: {
    fontFamily: FONTS.regular,
    fontSize: 11,
  },
  activityRight: {
    alignItems: 'flex-end',
    marginLeft: SPACING.xs,
    gap: 4,
  },
  activityTime: {
    fontFamily: FONTS.medium,
    fontSize: 10,
  },
  emptyActivityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  emptyIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    marginBottom: 2,
  },
  emptyCardDesc: {
    fontFamily: FONTS.regular,
    fontSize: 11,
  },
});

export default DashboardScreen;
