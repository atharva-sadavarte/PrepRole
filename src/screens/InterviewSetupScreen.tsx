import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  Animated,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../context/ThemeContext';
import {SPACING, RADIUS, ICON_SIZES, FONTS} from '../lib/theme';
import Icon from '../components/Icon';
import {ExperienceLevel, InterviewMode} from '../types/interview';

const {width} = Dimensions.get('window');

const QUICK_ROLES = [
  'Full Stack Developer',
  'Frontend Engineer',
  'React Native Engineer',
  'Backend Developer',
  'DevOps / Cloud',
  'Data Analyst',
  'Product Manager',
];

interface InterviewSetupScreenProps {
  navigation: any;
}

export const InterviewSetupScreen: React.FC<InterviewSetupScreenProps> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();

  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('fresher');
  const [recordingMode, setRecordingMode] = useState<InterviewMode>('video');
  const [targetRole, setTargetRole] = useState('Full Stack Developer');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleStartDrill = () => {
    navigation.navigate('InterviewRecording', {
      experienceLevel,
      recordingMode,
      targetRole: targetRole.trim() || 'Software Engineer',
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={[colors.bgDark, colors.gradientMiddle, colors.gradientEnd]}
        style={styles.gradient}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              paddingTop: Math.max(insets.top, 14) + SPACING.xs,
              backgroundColor: colors.bgDark,
              borderBottomColor: colors.border,
            },
          ]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[
              styles.backButton,
              {
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
              },
            ]}
            activeOpacity={0.7}>
            <Icon name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
              Interview Coach
            </Text>
            <Text style={[styles.headerSubtitle, {color: colors.textSecondary}]}>
              1m to 1:30s Intro Pitch Drill
            </Text>
          </View>
          <View style={styles.headerRightSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {paddingBottom: Math.max(insets.bottom, 20) + 90},
          ]}
          showsVerticalScrollIndicator={false}>
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{translateY: slideAnim}],
            }}>
            {/* Banner card */}
            <LinearGradient
              colors={['#2A241E', '#1C1A18']}
              style={[
                styles.heroBanner,
                {borderColor: colors.border, backgroundColor: colors.bgCard},
              ]}>
              <View style={styles.bannerBadge}>
                <Icon name="sparkles" size={14} color={colors.primaryStart} />
                <Text style={[styles.bannerBadgeText, {color: colors.primaryStart}]}>
                  AI-Powered Intro Scoring
                </Text>
              </View>
              <Text style={[styles.bannerTitle, {color: colors.textPrimary}]}>
                Master the "Tell Me About Yourself" Question
              </Text>
              <Text style={[styles.bannerDesc, {color: colors.textSecondary}]}>
                The first 90 seconds set 80% of an interviewer's impression. Practice your pitch, receive an AI score, and get actionable suggestions tailored to your experience.
              </Text>
            </LinearGradient>

            {/* STEP 1: Experience Level */}
            <View style={styles.sectionHeader}>
              <View style={[styles.stepBadge, {backgroundColor: colors.accentSoft}]}>
                <Text style={[styles.stepBadgeText, {color: colors.primaryStart}]}>
                  1
                </Text>
              </View>
              <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
                Select Your Experience Level
              </Text>
            </View>
            <Text style={[styles.sectionHint, {color: colors.textSecondary}]}>
              The AI adjusts scoring criteria based on your career stage.
            </Text>

            <View style={styles.cardsRow}>
              {/* Fresher Option */}
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor:
                      experienceLevel === 'fresher'
                        ? colors.primaryStart
                        : colors.border,
                  },
                  experienceLevel === 'fresher' && styles.optionCardActive,
                ]}
                activeOpacity={0.85}
                onPress={() => setExperienceLevel('fresher')}>
                <View style={styles.optionCardTop}>
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor:
                          experienceLevel === 'fresher'
                            ? colors.accentSoft
                            : colors.bgCardLight,
                      },
                    ]}>
                    <Icon
                      name="school-outline"
                      size={24}
                      color={
                        experienceLevel === 'fresher'
                          ? colors.primaryStart
                          : colors.textSecondary
                      }
                    />
                  </View>
                  {experienceLevel === 'fresher' && (
                    <View
                      style={[
                        styles.checkBadge,
                        {backgroundColor: colors.primaryStart},
                      ]}>
                      <Icon name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <Text style={[styles.optionTitle, {color: colors.textPrimary}]}>
                  Fresher / Entry
                </Text>
                <Text style={[styles.optionDesc, {color: colors.textSecondary}]}>
                  College grad or beginner. Scored on academic foundations, project highlights, technical passion & curiosity.
                </Text>
              </TouchableOpacity>

              {/* Experienced Option */}
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor:
                      experienceLevel === 'experienced'
                        ? colors.primaryStart
                        : colors.border,
                  },
                  experienceLevel === 'experienced' && styles.optionCardActive,
                ]}
                activeOpacity={0.85}
                onPress={() => setExperienceLevel('experienced')}>
                <View style={styles.optionCardTop}>
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor:
                          experienceLevel === 'experienced'
                            ? colors.accentSoft
                            : colors.bgCardLight,
                      },
                    ]}>
                    <Icon
                      name="briefcase-outline"
                      size={24}
                      color={
                        experienceLevel === 'experienced'
                          ? colors.primaryStart
                          : colors.textSecondary
                      }
                    />
                  </View>
                  {experienceLevel === 'experienced' && (
                    <View
                      style={[
                        styles.checkBadge,
                        {backgroundColor: colors.primaryStart},
                      ]}>
                      <Icon name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <Text style={[styles.optionTitle, {color: colors.textPrimary}]}>
                  Experienced Pro
                </Text>
                <Text style={[styles.optionDesc, {color: colors.textSecondary}]}>
                  Industry experience. Scored on business metrics, engineering ownership, architecture depth & executive presence.
                </Text>
              </TouchableOpacity>
            </View>

            {/* STEP 2: Recording Mode */}
            <View style={[styles.sectionHeader, {marginTop: SPACING.lg}]}>
              <View style={[styles.stepBadge, {backgroundColor: colors.accentSoft}]}>
                <Text style={[styles.stepBadgeText, {color: colors.primaryStart}]}>
                  2
                </Text>
              </View>
              <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
                Choose Practice Mode
              </Text>
            </View>
            <Text style={[styles.sectionHint, {color: colors.textSecondary}]}>
              Record with video for complete feedback, or audio-only for quick voice drills.
            </Text>

            <View style={styles.cardsRow}>
              {/* Video Mode */}
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor:
                      recordingMode === 'video'
                        ? colors.primaryStart
                        : colors.border,
                  },
                  recordingMode === 'video' && styles.optionCardActive,
                ]}
                activeOpacity={0.85}
                onPress={() => setRecordingMode('video')}>
                <View style={styles.optionCardTop}>
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor:
                          recordingMode === 'video'
                            ? colors.accentSoft
                            : colors.bgCardLight,
                      },
                    ]}>
                    <Icon
                      name="videocam-outline"
                      size={24}
                      color={
                        recordingMode === 'video'
                          ? colors.primaryStart
                          : colors.textSecondary
                      }
                    />
                  </View>
                  {recordingMode === 'video' && (
                    <View
                      style={[
                        styles.checkBadge,
                        {backgroundColor: colors.primaryStart},
                      ]}>
                      <Icon name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <Text style={[styles.optionTitle, {color: colors.textPrimary}]}>
                  Video + Audio
                </Text>
                <Text style={[styles.optionDesc, {color: colors.textSecondary}]}>
                  Full interview simulation. Practice camera eye contact, posture, and verbal pitch.
                </Text>
              </TouchableOpacity>

              {/* Audio Mode */}
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor:
                      recordingMode === 'audio'
                        ? colors.primaryStart
                        : colors.border,
                  },
                  recordingMode === 'audio' && styles.optionCardActive,
                ]}
                activeOpacity={0.85}
                onPress={() => setRecordingMode('audio')}>
                <View style={styles.optionCardTop}>
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor:
                          recordingMode === 'audio'
                            ? colors.accentSoft
                            : colors.bgCardLight,
                      },
                    ]}>
                    <Icon
                      name="mic-outline"
                      size={24}
                      color={
                        recordingMode === 'audio'
                          ? colors.primaryStart
                          : colors.textSecondary
                      }
                    />
                  </View>
                  {recordingMode === 'audio' && (
                    <View
                      style={[
                        styles.checkBadge,
                        {backgroundColor: colors.primaryStart},
                      ]}>
                      <Icon name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <Text style={[styles.optionTitle, {color: colors.textPrimary}]}>
                  Audio Only
                </Text>
                <Text style={[styles.optionDesc, {color: colors.textSecondary}]}>
                  Microphone only. Low-pressure elevator pitch focus on verbal clarity, tone, and pacing.
                </Text>
              </TouchableOpacity>
            </View>

            {/* STEP 3: Target Role */}
            <View style={[styles.sectionHeader, {marginTop: SPACING.lg}]}>
              <View style={[styles.stepBadge, {backgroundColor: colors.accentSoft}]}>
                <Text style={[styles.stepBadgeText, {color: colors.primaryStart}]}>
                  3
                </Text>
              </View>
              <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
                Target Job Role
              </Text>
            </View>

            <View
              style={[
                styles.inputWrapper,
                {backgroundColor: colors.bgInput, borderColor: colors.border},
              ]}>
              <Icon
                name="briefcase"
                size={18}
                color={colors.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                value={targetRole}
                onChangeText={setTargetRole}
                placeholder="e.g. React Native Engineer"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, {color: colors.textPrimary}]}
              />
            </View>

            {/* Quick Role Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillsContainer}>
              {QUICK_ROLES.map(role => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.rolePill,
                    {
                      backgroundColor:
                        targetRole === role ? colors.primaryStart : colors.bgCard,
                      borderColor:
                        targetRole === role ? colors.primaryStart : colors.border,
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => setTargetRole(role)}>
                  <Text
                    style={[
                      styles.rolePillText,
                      {
                        color:
                          targetRole === role
                            ? '#FFFFFF'
                            : colors.textSecondary,
                      },
                    ]}>
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* STEP 4: 60s - 90s Formula Guidelines */}
            <View
              style={[
                styles.guideCard,
                {
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                },
              ]}>
              <View style={styles.guideCardHeader}>
                <Icon name="timer-outline" size={20} color={colors.primaryStart} />
                <Text
                  style={[styles.guideCardTitle, {color: colors.textPrimary}]}>
                  The 60–90 Second Intro Blueprint
                </Text>
              </View>

              <View style={styles.guideItem}>
                <View
                  style={[
                    styles.guideItemDot,
                    {backgroundColor: colors.primaryStart},
                  ]}
                />
                <Text
                  style={[styles.guideItemText, {color: colors.textSecondary}]}>
                  <Text style={{color: colors.textPrimary, fontFamily: FONTS.semiBold}}>
                    1. The Hook (15–20s):{' '}
                  </Text>
                  Who you are, your current background or degree, and core specialty.
                </Text>
              </View>

              <View style={styles.guideItem}>
                <View
                  style={[
                    styles.guideItemDot,
                    {backgroundColor: colors.primaryStart},
                  ]}
                />
                <Text
                  style={[styles.guideItemText, {color: colors.textSecondary}]}>
                  <Text style={{color: colors.textPrimary, fontFamily: FONTS.semiBold}}>
                    2. The Impact (35–45s):{' '}
                  </Text>
                  {experienceLevel === 'fresher'
                    ? 'Highlight 1 standout project, tech stack used, and the problem you solved.'
                    : '1 key career highlight with quantifiable metrics & leadership outcome.'}
                </Text>
              </View>

              <View style={styles.guideItem}>
                <View
                  style={[
                    styles.guideItemDot,
                    {backgroundColor: colors.primaryStart},
                  ]}
                />
                <Text
                  style={[styles.guideItemText, {color: colors.textSecondary}]}>
                  <Text style={{color: colors.textPrimary, fontFamily: FONTS.semiBold}}>
                    3. The Forward Pitch (15–20s):{' '}
                  </Text>
                  Why you are excited about this role and how you will create immediate value.
                </Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Bottom Action Footer */}
        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: colors.bgDark,
              borderTopColor: colors.border,
            },
          ]}>
          <TouchableOpacity
            style={styles.startButton}
            activeOpacity={0.85}
            onPress={handleStartDrill}>
            <LinearGradient
              colors={[colors.primaryStart, colors.primaryEnd]}
              style={styles.startButtonGradient}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}>
              <Icon
                name={recordingMode === 'video' ? 'videocam' : 'mic'}
                size={20}
                color="#FFFFFF"
                style={{marginRight: 8}}
              />
              <Text style={styles.startButtonText}>
                Enter Recording Studio
              </Text>
              <Icon
                name="arrow-forward"
                size={18}
                color="#FFFFFF"
                style={{marginLeft: 6}}
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitleWrap: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    marginTop: 2,
  },
  headerRightSpacer: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  heroBanner: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(196, 154, 114, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginBottom: 8,
  },
  bannerBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    marginLeft: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bannerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 6,
  },
  bannerDesc: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  stepBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
  },
  sectionHint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    marginBottom: SPACING.sm,
    marginLeft: 30,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  optionCard: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    padding: SPACING.sm + 2,
    minHeight: 145,
  },
  optionCardActive: {
    transform: [{scale: 1.01}],
  },
  optionCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    marginBottom: 4,
  },
  optionDesc: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    lineHeight: 15,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    height: 48,
    marginBottom: SPACING.xs,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 14,
    padding: 0,
  },
  pillsContainer: {
    paddingVertical: 6,
    gap: 8,
    marginBottom: SPACING.sm,
  },
  rolePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  rolePillText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  guideCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginTop: SPACING.md,
  },
  guideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  guideCardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    marginLeft: 8,
  },
  guideItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  guideItemDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: 8,
  },
  guideItemText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  footer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  startButton: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    paddingHorizontal: SPACING.md,
  },
  startButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});

export default InterviewSetupScreen;
