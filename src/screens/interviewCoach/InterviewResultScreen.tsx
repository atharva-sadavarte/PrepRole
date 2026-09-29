import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../context/ThemeContext';
import {SPACING, RADIUS, FONTS} from '../../lib/theme';
import Icon from '../../components/Icon';
import {InterviewAttempt} from '../../types/interviewCoach';
import {getAttemptsForJourney} from '../../services/interviewCoachService';

interface InterviewResultScreenProps {
  route: {
    params: {
      journeyId: string;
      roundNumber?: number;
      jobRole: string;
    };
  };
  navigation: any;
}

export const InterviewResultScreen: React.FC<InterviewResultScreenProps> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();
  const {journeyId, roundNumber, jobRole} = route.params;

  const [attempts, setAttempts] = useState<InterviewAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAttempts();
  }, [journeyId]);

  const loadAttempts = async () => {
    setLoading(true);
    const list = await getAttemptsForJourney(journeyId);
    if (roundNumber) {
      setAttempts(list.filter(a => a.roundNumber === roundNumber));
    } else {
      setAttempts(list);
    }
    setLoading(false);
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
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
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, {backgroundColor: colors.bgCard, borderColor: colors.border}]}
          activeOpacity={0.7}>
          <Icon name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
            Attempt History
          </Text>
          <Text style={[styles.headerSubtitle, {color: colors.textSecondary}]}>
            {jobRole} {roundNumber ? `• Round ${roundNumber}` : ''}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: Math.max(insets.bottom, 20) + 40},
        ]}
        showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primaryStart} style={{marginTop: 30}} />
        ) : attempts.length === 0 ? (
          <View style={[styles.emptyBox, {backgroundColor: colors.bgCard, borderColor: colors.border}]}>
            <Icon name="time-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, {color: colors.textPrimary}]}>
              No attempt history yet
            </Text>
            <Text style={[styles.emptySub, {color: colors.textSecondary}]}>
              Your scored audio recordings and feedback will appear here.
            </Text>
          </View>
        ) : (
          attempts.map((att, idx) => (
            <View
              key={att.id}
              style={[
                styles.attemptCard,
                {backgroundColor: colors.bgCard, borderColor: colors.border},
              ]}>
              <View style={styles.attemptCardTop}>
                <View>
                  <Text style={[styles.attemptRoundTitle, {color: colors.textPrimary}]}>
                    Round {att.roundNumber} Attempt #{attempts.length - idx}
                  </Text>
                  <Text style={[styles.attemptDate, {color: colors.textMuted}]}>
                    {formatDate(att.createdAt)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.scoreBadge,
                    {
                      backgroundColor: att.passed ? '#D1FAE5' : '#FEE2E2',
                      borderColor: att.passed ? '#10B981' : '#EF4444',
                    },
                  ]}>
                  <Text
                    style={[
                      styles.scoreBadgeText,
                      {color: att.passed ? '#065F46' : '#991B1B'},
                    ]}>
                    {att.score.toFixed(1)} / 5.0
                  </Text>
                </View>
              </View>

              <Text style={[styles.attemptQuestion, {color: colors.textSecondary}]}>
                Q: {att.question}
              </Text>

              <View
                style={[
                  styles.responseSnippetBox,
                  {backgroundColor: isDark ? '#18181B' : '#F4F4F5'},
                ]}>
                <Text
                  style={[styles.responseSnippetText, {color: colors.textPrimary}]}
                  numberOfLines={3}>
                  "{att.userResponseText}"
                </Text>
              </View>

              <View style={styles.ratingsRow}>
                <Text style={[styles.ratingPill, {color: colors.textSecondary}]}>
                  Structure: {att.ratings.structure.toFixed(1)}
                </Text>
                <Text style={[styles.ratingPill, {color: colors.textSecondary}]}>
                  Relevance: {att.ratings.relevance.toFixed(1)}
                </Text>
                <Text style={[styles.ratingPill, {color: colors.textSecondary}]}>
                  Delivery: {att.ratings.delivery.toFixed(1)}
                </Text>
              </View>

              <Text style={[styles.attemptFeedback, {color: colors.textSecondary}]}>
                {att.feedback}
              </Text>
            </View>
          ))
        )}
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
  scroll: {flex: 1},
  scrollContent: {padding: SPACING.md},
  emptyBox: {
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {fontSize: 15, fontFamily: FONTS.bold, marginTop: SPACING.sm},
  emptySub: {fontSize: 12, fontFamily: FONTS.regular, textAlign: 'center', marginTop: 4},
  attemptCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  attemptCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  attemptRoundTitle: {fontSize: 14, fontFamily: FONTS.bold},
  attemptDate: {fontSize: 11, fontFamily: FONTS.regular, marginTop: 2},
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  scoreBadgeText: {fontSize: 12, fontFamily: FONTS.bold},
  attemptQuestion: {fontSize: 12, fontFamily: FONTS.medium, marginBottom: 8},
  responseSnippetBox: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: 8,
  },
  responseSnippetText: {fontSize: 12, fontFamily: FONTS.regular, fontStyle: 'italic', lineHeight: 17},
  ratingsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  ratingPill: {fontSize: 11, fontFamily: FONTS.semiBold},
  attemptFeedback: {fontSize: 12, fontFamily: FONTS.regular, lineHeight: 17},
});

export default InterviewResultScreen;
