import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../context/ThemeContext';
import {SPACING, RADIUS, FONTS} from '../../lib/theme';
import Icon from '../../components/Icon';
import {InterviewAttempt} from '../../types/interviewCoach';
import {
  speakQuestionText,
  playNativeAudio,
  stopNativeAudio,
} from '../../services/interviewMediaService';

interface InterviewFeedbackScreenProps {
  route: {
    params: {
      journeyId: string;
      roundNumber: number;
      attempt: InterviewAttempt;
      jobRole: string;
    };
  };
  navigation: any;
}

export const InterviewFeedbackScreen: React.FC<InterviewFeedbackScreenProps> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();
  const {journeyId, roundNumber, attempt, jobRole} = route.params;

  const [isPlayingSample, setIsPlayingSample] = useState(false);
  const [isPlayingUserAudio, setIsPlayingUserAudio] = useState(false);

  const passed = attempt.passed;
  const isFinalRound = roundNumber === 10;

  const handleToggleUserAudio = async () => {
    if (!attempt.audioUri) return;
    if (isPlayingUserAudio) {
      await stopNativeAudio();
      setIsPlayingUserAudio(false);
    } else {
      setIsPlayingUserAudio(true);
      await playNativeAudio(attempt.audioUri);
      const durationMs = (attempt.durationSeconds || 10) * 1000;
      setTimeout(() => setIsPlayingUserAudio(false), durationMs);
    }
  };

  const handlePlaySampleAnswer = async () => {
    if (!attempt.sampleAnswer) return;
    setIsPlayingSample(true);
    try {
      await speakQuestionText(attempt.sampleAnswer);
    } catch {}
    setIsPlayingSample(false);
  };

  const handleRetryQuestion = () => {
    navigation.navigate('InterviewSession', {
      journeyId,
      jobRole,
    });
  };

  const handleTryNextQuestion = () => {
    navigation.navigate('InterviewSession', {
      journeyId,
      jobRole,
    });
  };

  const handleViewAllAttempts = () => {
    navigation.navigate('InterviewCoachResult', {
      journeyId,
      roundNumber,
      jobRole,
    });
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.bgDark}]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 16) + SPACING.xs,
            backgroundColor: colors.bgDark,
            borderBottomColor: colors.border,
          },
        ]}>
        <TouchableOpacity
          onPress={() => navigation.navigate('InterviewSession', {journeyId, jobRole})}
          style={[styles.backBtn, {backgroundColor: colors.bgCard, borderColor: colors.border}]}
          activeOpacity={0.7}>
          <Icon name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
            Round {roundNumber} Feedback
          </Text>
          <Text style={[styles.headerSubtitle, {color: colors.textSecondary}]}>
            {jobRole}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleViewAllAttempts}
          style={[styles.historyBtn, {borderColor: colors.border}]}>
          <Icon name="time-outline" size={18} color={colors.primaryStart} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: Math.max(insets.bottom, 20) + 40},
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Score Hero Card */}
        <LinearGradient
          colors={passed ? ['#064E3B', '#065F46', '#042F2E'] : ['#7F1D1D', '#991B1B', '#450A0A']}
          style={[styles.heroCard, {borderColor: passed ? '#10B981' : '#EF4444'}]}>
          <View style={styles.scoreRow}>
            <View>
              <Text style={styles.scoreLabel}>
                {passed ? 'ROUND PASSED' : 'NEEDS IMPROVEMENT'}
              </Text>
              <Text style={styles.scoreValue}>
                {attempt.score.toFixed(1)} <Text style={styles.scoreScale}>/ 5.0</Text>
              </Text>
            </View>
            <View style={styles.scoreBadgeWrap}>
              <Icon
                name={passed ? 'checkmark-circle' : 'alert-circle'}
                size={44}
                color="#FFFFFF"
              />
            </View>
          </View>
          <Text style={styles.heroSubText}>
            {passed
              ? isFinalRound
                ? 'Outstanding! You have conquered the real interview trial and completed this entire journey!'
                : `Score meets passing threshold (≥ 3.0). Round ${roundNumber + 1} has been unlocked.`
              : 'Pass threshold is 3.0 out of 5.0. Review coaching points below and retry this round.'}
          </Text>
        </LinearGradient>

        {/* Attribute Breakdown Grid */}
        <View
          style={[
            styles.breakdownCard,
            {backgroundColor: colors.bgCard, borderColor: colors.border},
          ]}>
          <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
            Evaluation Breakdown
          </Text>
          <View style={styles.gridRow}>
            <View style={[styles.gridCol, {borderColor: colors.border}]}>
              <Text style={[styles.gridLabel, {color: colors.textMuted}]}>STRUCTURE</Text>
              <Text style={[styles.gridScore, {color: colors.textPrimary}]}>
                {attempt.ratings.structure.toFixed(1)} <Text style={{fontSize: 11}}>/ 5</Text>
              </Text>
              <Text style={[styles.gridDesc, {color: colors.textSecondary}]}>Opening & Flow</Text>
            </View>

            <View style={[styles.gridCol, {borderColor: colors.border}]}>
              <Text style={[styles.gridLabel, {color: colors.textMuted}]}>RELEVANCE</Text>
              <Text style={[styles.gridScore, {color: colors.textPrimary}]}>
                {attempt.ratings.relevance.toFixed(1)} <Text style={{fontSize: 11}}>/ 5</Text>
              </Text>
              <Text style={[styles.gridDesc, {color: colors.textSecondary}]}>Role Alignment</Text>
            </View>

            <View style={[styles.gridCol, {borderColor: colors.border}]}>
              <Text style={[styles.gridLabel, {color: colors.textMuted}]}>DELIVERY</Text>
              <Text style={[styles.gridScore, {color: colors.textPrimary}]}>
                {attempt.ratings.delivery.toFixed(1)} <Text style={{fontSize: 11}}>/ 5</Text>
              </Text>
              <Text style={[styles.gridDesc, {color: colors.textSecondary}]}>Audio & Pacing</Text>
            </View>
          </View>
        </View>

        {/* AI Multimodal Audio & Voice Analysis */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#1C152B' : '#F5F3FF',
              borderColor: '#8B5CF6',
            },
          ]}>
          <View style={styles.aiBadgeHeader}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 4}}>
              <Icon name="sparkles" size={16} color="#8B5CF6" />
              <Text style={[styles.cardHeading, {color: isDark ? '#DDD6FE' : '#5B21B6', marginBottom: 0}]}>
                AI Audio Intelligence
              </Text>
            </View>
            <View style={styles.geminiTag}>
              <Text style={styles.geminiTagText}>GEMINI AI</Text>
            </View>
          </View>
          <Text style={[styles.aiVoiceSub, {color: isDark ? '#C4B5FD' : '#6D28D9'}]}>
            Spoken audio analyzed for vocal confidence, delivery tempo, and acoustic clarity.
          </Text>

          <View style={styles.audioMetricsGrid}>
            <View style={[styles.metricPillCard, {backgroundColor: isDark ? '#2E1E4A' : '#EDE9FE'}]}>
              <Icon name="mic" size={14} color="#8B5CF6" />
              <Text style={[styles.metricPillLabel, {color: isDark ? '#C4B5FD' : '#6D28D9'}]}>
                CONFIDENCE
              </Text>
              <Text style={[styles.metricPillValue, {color: isDark ? '#FFFFFF' : '#4C1D95'}]}>
                {attempt.audioMetrics?.vocalConfidence || (passed ? 'High' : 'Needs Practice')}
              </Text>
            </View>

            <View style={[styles.metricPillCard, {backgroundColor: isDark ? '#2E1E4A' : '#EDE9FE'}]}>
              <Icon name="speedometer-outline" size={14} color="#8B5CF6" />
              <Text style={[styles.metricPillLabel, {color: isDark ? '#C4B5FD' : '#6D28D9'}]}>
                SPEECH PACE
              </Text>
              <Text style={[styles.metricPillValue, {color: isDark ? '#FFFFFF' : '#4C1D95'}]}>
                {attempt.audioMetrics?.speechPace || '125 WPM (Optimal)'}
              </Text>
            </View>

            <View style={[styles.metricPillCard, {backgroundColor: isDark ? '#2E1E4A' : '#EDE9FE'}]}>
              <Icon name="volume-high" size={14} color="#8B5CF6" />
              <Text style={[styles.metricPillLabel, {color: isDark ? '#C4B5FD' : '#6D28D9'}]}>
                CLARITY
              </Text>
              <Text style={[styles.metricPillValue, {color: isDark ? '#FFFFFF' : '#4C1D95'}]}>
                {attempt.audioMetrics?.audioClarity || 'Clear Speech'}
              </Text>
            </View>
          </View>
        </View>

        {/* Question & Spoken Response Card with User Audio Playback */}
        <View
          style={[
            styles.card,
            {backgroundColor: colors.bgCard, borderColor: colors.border},
          ]}>
          <View style={styles.submittedAnswerHeader}>
            <Text style={[styles.cardHeading, {color: colors.textPrimary, marginBottom: 0}]}>
              Your Submitted Answer
            </Text>
            {attempt.audioUri && (
              <TouchableOpacity
                onPress={handleToggleUserAudio}
                style={[
                  styles.listenBtn,
                  {borderColor: isPlayingUserAudio ? '#10B981' : colors.primaryStart},
                ]}>
                <Icon
                  name={isPlayingUserAudio ? 'pause' : 'play'}
                  size={13}
                  color={isPlayingUserAudio ? '#10B981' : colors.primaryStart}
                />
                <Text
                  style={[
                    styles.listenBtnText,
                    {color: isPlayingUserAudio ? '#10B981' : colors.primaryStart},
                  ]}>
                  {isPlayingUserAudio ? 'Pause' : 'Play My Audio'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.userAnswerText, {color: colors.textSecondary}]}>
            "{attempt.userResponseText}"
          </Text>
        </View>

        {/* AI Coaching Critique */}
        <View
          style={[
            styles.card,
            {backgroundColor: colors.bgCard, borderColor: colors.border},
          ]}>
          <View style={styles.cardHeaderWithIcon}>
            <Icon name="sparkles" size={18} color={colors.primaryStart} />
            <Text style={[styles.cardHeading, {color: colors.textPrimary, marginLeft: 6}]}>
              Coach Feedback
            </Text>
          </View>
          <Text style={[styles.feedbackBodyText, {color: colors.textSecondary}]}>
            {attempt.feedback}
          </Text>

          {/* Strengths */}
          {attempt.strengths.length > 0 && (
            <View style={styles.pillListWrap}>
              <Text style={[styles.pillListHeader, {color: '#10B981'}]}>
                KEY STRENGTHS
              </Text>
              {attempt.strengths.map((str, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <Icon name="checkmark" size={14} color="#10B981" />
                  <Text style={[styles.bulletText, {color: colors.textPrimary}]}>
                    {str}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Improvements */}
          {attempt.improvements.length > 0 && (
            <View style={styles.pillListWrap}>
              <Text style={[styles.pillListHeader, {color: '#F59E0B'}]}>
                ACTIONABLE IMPROVEMENTS
              </Text>
              {attempt.improvements.map((imp, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <Icon name="arrow-forward" size={14} color="#F59E0B" />
                  <Text style={[styles.bulletText, {color: colors.textPrimary}]}>
                    {imp}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Gold Standard Sample Answer */}
        {attempt.sampleAnswer && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? '#1C1917' : '#FFFBEB',
                borderColor: '#F59E0B',
              },
            ]}>
            <View style={styles.sampleHeaderRow}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                <Icon name="star" size={16} color="#D97706" />
                <Text style={[styles.sampleTitle, {color: isDark ? '#FDE68A' : '#92400E'}]}>
                  Gold Standard Model Answer
                </Text>
              </View>
              <TouchableOpacity
                onPress={handlePlaySampleAnswer}
                disabled={isPlayingSample}
                style={[
                  styles.listenBtn,
                  {borderColor: isDark ? '#D97706' : '#F59E0B'},
                ]}>
                <Icon
                  name={isPlayingSample ? 'volume-high' : 'volume-medium-outline'}
                  size={14}
                  color="#D97706"
                />
                <Text style={[styles.listenBtnText, {color: '#D97706'}]}>
                  {isPlayingSample ? 'Playing...' : 'Listen'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.sampleAnswerBody, {color: isDark ? '#F5F5F4' : '#78350F'}]}>
              {attempt.sampleAnswer}
            </Text>
          </View>
        )}

        {/* Footer Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.retryBtn, {borderColor: colors.border}]}
            onPress={handleRetryQuestion}
            activeOpacity={0.8}>
            <Icon name="refresh" size={16} color={colors.textPrimary} />
            <Text style={[styles.retryBtnText, {color: colors.textPrimary}]}>
              Retry Question
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.nextBtn, {backgroundColor: colors.primaryStart}]}
            onPress={passed ? handleTryNextQuestion : handleRetryQuestion}
            activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>
              {passed ? (isFinalRound ? 'View Dashboard' : 'Try Next Round') : 'Reattempt Round'}
            </Text>
            <Icon name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitleWrap: {flex: 1, marginLeft: SPACING.sm},
  headerTitle: {fontSize: 17, fontFamily: FONTS.bold},
  headerSubtitle: {fontSize: 12, fontFamily: FONTS.regular},
  historyBtn: {
    padding: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  scroll: {flex: 1},
  scrollContent: {padding: SPACING.md},
  heroCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  scoreLabel: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    color: '#E5E7EB',
    letterSpacing: 0.5,
  },
  scoreValue: {
    fontSize: 34,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  scoreScale: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: '#D1D5DB',
  },
  scoreBadgeWrap: {
    padding: 6,
  },
  heroSubText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#F3F4F6',
    lineHeight: 18,
  },
  breakdownCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    marginBottom: SPACING.sm,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gridCol: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  gridLabel: {
    fontSize: 9,
    fontFamily: FONTS.bold,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  gridScore: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    marginVertical: 2,
  },
  gridDesc: {
    fontSize: 10,
    fontFamily: FONTS.regular,
  },
  card: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  cardHeading: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    marginBottom: SPACING.xs,
  },
  aiBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  geminiTag: {
    backgroundColor: '#8B5CF620',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#8B5CF640',
  },
  geminiTagText: {
    color: '#8B5CF6',
    fontSize: 10,
    fontFamily: FONTS.bold,
    letterSpacing: 0.5,
  },
  aiVoiceSub: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    lineHeight: 15,
    marginBottom: SPACING.sm,
  },
  audioMetricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  metricPillCard: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  metricPillLabel: {
    fontSize: 8,
    fontFamily: FONTS.bold,
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 2,
    textAlign: 'center',
  },
  metricPillValue: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    textAlign: 'center',
  },
  submittedAnswerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  cardHeaderWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  userAnswerText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  feedbackBodyText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    lineHeight: 19,
    marginBottom: SPACING.sm,
  },
  pillListWrap: {
    marginTop: SPACING.sm,
  },
  pillListHeader: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginVertical: 2,
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FONTS.regular,
    lineHeight: 17,
  },
  sampleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  sampleTitle: {
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  listenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 4,
  },
  listenBtnText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
  },
  sampleAnswerBody: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    lineHeight: 19,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SPACING.xs,
  },
  retryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 6,
  },
  retryBtnText: {fontSize: 13, fontFamily: FONTS.semiBold},
  nextBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  nextBtnText: {color: '#FFFFFF', fontSize: 13, fontFamily: FONTS.semiBold},
});

export default InterviewFeedbackScreen;
