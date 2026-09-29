import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  Share,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../context/ThemeContext';
import {SPACING, RADIUS, FONTS} from '../../lib/theme';
import Icon from '../../components/Icon';
import type {Session} from '@supabase/supabase-js';
import {
  PersonalPitch,
  PitchSectionKey,
  PITCH_SECTIONS,
} from '../../types/pitchTrainer';
import {
  getPersonalPitches,
  updatePitch,
  deletePitch,
  analyzePersonalPitch,
  getPitchShareUrl,
} from '../../services/pitchTrainerService';

interface PitchTrainerFeedbackScreenProps {
  route: {
    params: {
      pitchId: string;
      jobRole: string;
      isView?: boolean;
      initialPitch?: PersonalPitch;
    };
  };
  navigation: any;
  session: Session;
}

export const PitchTrainerFeedbackScreen: React.FC<PitchTrainerFeedbackScreenProps> = ({
  route,
  navigation,
  session,
}) => {
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();
  const userId = session?.user?.id || 'guest_user';
  const {pitchId, jobRole, isView, initialPitch} = route.params;

  const [pitch, setPitch] = useState<PersonalPitch | null>(initialPitch || null);
  const [isAnalyzing, setIsAnalyzing] = useState(!initialPitch || initialPitch.status === 'submitted');
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // Poll count
  const pollCountRef = useRef(0);
  const reattemptsRef = useRef(0);

  useEffect(() => {
    if (!initialPitch || initialPitch.status === 'submitted') {
      startAnalysisProcess();
    }
  }, [pitchId]);

  const startAnalysisProcess = async () => {
    setIsAnalyzing(true);
    pollCountRef.current = 0;

    const all = await getPersonalPitches(userId);
    let target = all.find(p => p.id === pitchId);

    if (target) {
      if (!target.analysis) {
        try {
          const analysisRes = await analyzePersonalPitch(target);
          target = await updatePitch(userId, pitchId, {
            status: 'analyzed',
            analysis: analysisRes,
          });
        } catch (e) {
          console.warn('AI analysis error, auto-retrying up to 3 times (Rule PT-22):', e);
          if (reattemptsRef.current < 3) {
            reattemptsRef.current += 1;
            setTimeout(startAnalysisProcess, 3000);
            return;
          }
        }
      }
      setPitch(target);
      setIsAnalyzing(false);
    } else {
      setIsAnalyzing(false);
    }
  };

  // Rule PT-25: Save pitch
  const handleSavePitch = async () => {
    if (!pitch) return;
    try {
      const saved = await updatePitch(userId, pitch.id, {status: 'saved'});
      setPitch(saved);
      setShowSavedModal(true);
    } catch {
      Alert.alert('Error', 'Could not save pitch.');
    }
  };

  // Rule PT-25: Discard pitch (delete)
  const handleConfirmDiscard = async () => {
    setShowDiscardModal(false);
    if (!pitch) return;
    await deletePitch(userId, pitch.id);
    navigation.navigate('PitchTrainerMain');
  };

  // Share pitch web link
  const handleSharePitch = async () => {
    if (!pitch) return;
    const url = getPitchShareUrl(pitch.id, pitch.language);
    try {
      await Share.share({
        message: `Check out my elevator pitch for ${pitch.jobRole} on PrepRole: ${url}`,
        url,
      });
    } catch {}
  };

  if (isAnalyzing) {
    return (
      <View style={[styles.loadingContainer, {backgroundColor: colors.bgDark}]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <LinearGradient
          colors={['#2E1E3B', '#1E1528', '#140D1C']}
          style={[styles.intermittentCard, {borderColor: colors.border}]}>
          <ActivityIndicator size="large" color="#D8B4FE" />
          <Text style={styles.intermittentTitle}>Analyzing Your Response...</Text>
          <Text style={styles.intermittentSub}>
            Our AI Speech Coach is scoring your 6 pitch sections, delivery presence, and drafting personalized recommendations.
          </Text>
          <View style={styles.pulseBar}>
            <View style={styles.pulseBarFill} />
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (!pitch || !pitch.analysis) {
    return (
      <View style={[styles.loadingContainer, {backgroundColor: colors.bgDark}]}>
        <Text style={[styles.errorText, {color: colors.textPrimary}]}>
          Pitch evaluation unavailable.
        </Text>
        <TouchableOpacity
          style={[styles.retryBtn, {backgroundColor: colors.primaryStart, marginTop: 12}]}
          onPress={() => navigation.goBack()}>
          <Text style={styles.btnTextWhite}>Return</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const analysis = pitch.analysis;

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
          onPress={() => navigation.navigate('PitchTrainerMain')}
          style={[styles.backBtn, {backgroundColor: colors.bgCard, borderColor: colors.border}]}
          activeOpacity={0.7}>
          <Icon name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, {color: colors.textPrimary}]} numberOfLines={1}>
            Pitch Evaluation
          </Text>
          <Text style={[styles.headerSubtitle, {color: colors.textSecondary}]}>
            {pitch.jobRole}
          </Text>
        </View>

        {isView && (
          <TouchableOpacity
            onPress={handleSharePitch}
            style={[styles.shareBtn, {borderColor: colors.border}]}>
            <Icon name="share-social-outline" size={18} color={colors.primaryStart} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: Math.max(insets.bottom, 20) + (isView ? 40 : 100)},
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Overall Score Hero Card with 5 Emoji Bands (Rule PT-24) */}
        <LinearGradient
          colors={['#2E1E3B', '#1E1528', '#140D1C']}
          style={[styles.scoreHeroCard, {borderColor: '#A855F7'}]}>
          <View style={styles.scoreTopRow}>
            <View>
              <Text style={styles.scoreHeroLabel}>OVERALL PITCH RATING</Text>
              <View style={{flexDirection: 'row', alignItems: 'baseline'}}>
                <Text style={styles.scoreHeroNumber}>
                  {analysis.overallRating.toFixed(1)}
                </Text>
                <Text style={styles.scoreHeroScale}> / 5.0</Text>
              </View>
            </View>
            <View style={styles.emojiBadge}>
              <Text style={styles.emojiText}>{analysis.scoreBandEmoji}</Text>
            </View>
          </View>
          <Text style={styles.scoreBandLabel}>{analysis.scoreBandLabel}</Text>
        </LinearGradient>

        {/* 6 Pitch Sections Breakdown (Rule PT-23) */}
        <View
          style={[
            styles.card,
            {backgroundColor: colors.bgCard, borderColor: colors.border},
          ]}>
          <Text style={[styles.cardTitle, {color: colors.textPrimary}]}>
            Section-by-Section Scoring
          </Text>
          <Text style={[styles.cardSub, {color: colors.textSecondary}]}>
            Evaluation of the 6 core pillars of an executive elevator pitch
          </Text>

          <View style={styles.sectionsList}>
            {PITCH_SECTIONS.map((sec, idx) => {
              const secScore = analysis.sectionScores?.[sec.key as PitchSectionKey];
              const isCovered = secScore?.covered ?? true;
              return (
                <View
                  key={sec.key}
                  style={[
                    styles.sectionItemCard,
                    {
                      backgroundColor: isDark ? '#18181B' : '#F8FAFC',
                      borderColor: colors.border,
                    },
                  ]}>
                  <View style={styles.sectionItemTop}>
                    <Text style={[styles.sectionName, {color: colors.textPrimary}]}>
                      {idx + 1}. {sec.title}
                    </Text>
                    {isCovered ? (
                      <View style={[styles.secScoreBadge, {backgroundColor: colors.accentSoft}]}>
                        <Text style={[styles.secScoreText, {color: colors.primaryStart}]}>
                          {secScore?.score?.toFixed(1) || '3.5'} / 5.0
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.naBadge}>
                        <Text style={styles.naText}>Not Applicable</Text>
                      </View>
                    )}
                  </View>

                  <Text style={[styles.secFeedbackText, {color: colors.textSecondary}]}>
                    {secScore?.feedback || `Solid presentation of your ${sec.title}.`}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Strengths & Improvements */}
        <View
          style={[
            styles.card,
            {backgroundColor: colors.bgCard, borderColor: colors.border},
          ]}>
          <Text style={[styles.cardTitle, {color: colors.textPrimary}]}>
            Coaching Highlights
          </Text>

          {/* Strengths */}
          <View style={styles.subPillSection}>
            <Text style={[styles.subPillHeader, {color: '#10B981'}]}>STRENGTHS</Text>
            {analysis.strengths.map((str, i) => (
              <View key={i} style={styles.bulletRow}>
                <Icon name="checkmark-circle" size={16} color="#10B981" />
                <Text style={[styles.bulletText, {color: colors.textPrimary}]}>
                  {str}
                </Text>
              </View>
            ))}
          </View>

          {/* Improvements */}
          <View style={styles.subPillSection}>
            <Text style={[styles.subPillHeader, {color: '#F59E0B'}]}>
              KEY IMPROVEMENT AREAS
            </Text>
            {analysis.improvements.map((imp, i) => (
              <View key={i} style={styles.bulletRow}>
                <Icon name="arrow-forward" size={16} color="#F59E0B" />
                <Text style={[styles.bulletText, {color: colors.textPrimary}]}>
                  {imp}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Gold Standard Script Rewrite */}
        {analysis.idealPitchScript && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? '#1C1917' : '#FEF3C7',
                borderColor: '#F59E0B',
              },
            ]}>
            <View style={styles.goldHeader}>
              <Icon name="sparkles" size={18} color="#D97706" />
              <Text style={[styles.goldTitle, {color: isDark ? '#FDE68A' : '#92400E'}]}>
                Gold Standard Rewrite Script
              </Text>
            </View>
            <Text style={[styles.goldScriptBody, {color: isDark ? '#F5F5F4' : '#78350F'}]}>
              "{analysis.idealPitchScript}"
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Floating Bottom Bar: Save & Discard (Rule PT-25) */}
      {!isView && (
        <View
          style={[
            styles.floatingBar,
            {
              backgroundColor: colors.bgDark,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 14),
            },
          ]}>
          <TouchableOpacity
            style={[styles.discardBtn, {borderColor: colors.border}]}
            onPress={() => setShowDiscardModal(true)}
            activeOpacity={0.8}>
            <Icon name="trash-outline" size={16} color="#EF4444" />
            <Text style={styles.discardBtnText}>Discard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveBtn, {backgroundColor: colors.primaryStart}]}
            onPress={handleSavePitch}
            activeOpacity={0.85}>
            <Icon name="bookmark" size={18} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>Save Pitch</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Saved Success Modal with Share Link */}
      <Modal visible={showSavedModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.savedModalBox,
              {backgroundColor: colors.bgCard, borderColor: colors.border},
            ]}>
            <Icon name="checkmark-circle" size={44} color="#10B981" />
            <Text style={[styles.savedModalTitle, {color: colors.textPrimary}]}>
              Pitch Saved Successfully!
            </Text>
            <Text style={[styles.savedModalSub, {color: colors.textSecondary}]}>
              Your pitch and AI scorecard are preserved in your library and shareable with hiring managers.
            </Text>

            <TouchableOpacity
              style={[styles.shareModalBtn, {borderColor: colors.border}]}
              onPress={handleSharePitch}>
              <Icon name="share-social-outline" size={16} color={colors.primaryStart} />
              <Text style={[styles.shareModalText, {color: colors.primaryStart}]}>
                Share Public Pitch Link
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.savedModalDoneBtn, {backgroundColor: colors.primaryStart}]}
              onPress={() => {
                setShowSavedModal(false);
                navigation.navigate('PitchTrainerMain');
              }}>
              <Text style={styles.savedModalDoneText}>Go to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Discard Confirmation Modal */}
      <Modal visible={showDiscardModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.savedModalBox,
              {backgroundColor: colors.bgCard, borderColor: colors.border},
            ]}>
            <Icon name="alert-circle-outline" size={40} color="#EF4444" />
            <Text style={[styles.savedModalTitle, {color: colors.textPrimary}]}>
              Discard This Pitch?
            </Text>
            <Text style={[styles.savedModalSub, {color: colors.textSecondary}]}>
              This will permanently delete this recording and analysis.
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalSecBtn, {borderColor: colors.border}]}
                onPress={() => setShowDiscardModal(false)}>
                <Text style={[styles.modalSecText, {color: colors.textSecondary}]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPriBtn, {backgroundColor: '#EF4444'}]}
                onPress={handleConfirmDiscard}>
                <Text style={styles.modalPriText}>Discard & Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  loadingContainer: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl},
  intermittentCard: {
    width: '100%',
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: 'center',
  },
  intermittentTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: FONTS.bold,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  intermittentSub: {
    color: '#D1D5DB',
    fontSize: 13,
    fontFamily: FONTS.regular,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.lg,
  },
  pulseBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    overflow: 'hidden',
  },
  pulseBarFill: {
    width: '70%',
    height: '100%',
    backgroundColor: '#D8B4FE',
    borderRadius: 2,
  },
  errorText: {fontSize: 14, fontFamily: FONTS.medium},
  retryBtn: {paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.md},
  btnTextWhite: {color: '#FFFFFF', fontSize: 13, fontFamily: FONTS.semiBold},
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
  shareBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scroll: {flex: 1},
  scrollContent: {padding: SPACING.md},
  scoreHeroCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  scoreTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreHeroLabel: {color: '#D8B4FE', fontSize: 11, fontFamily: FONTS.bold, letterSpacing: 0.5},
  scoreHeroNumber: {color: '#FFFFFF', fontSize: 36, fontFamily: FONTS.bold},
  scoreHeroScale: {color: '#E9D5FF', fontSize: 16, fontFamily: FONTS.regular},
  emojiBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {fontSize: 28},
  scoreBandLabel: {color: '#F3E8FF', fontSize: 15, fontFamily: FONTS.semiBold, marginTop: 4},
  card: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  cardTitle: {fontSize: 15, fontFamily: FONTS.bold},
  cardSub: {fontSize: 12, fontFamily: FONTS.regular, marginTop: 2, marginBottom: SPACING.sm},
  sectionsList: {gap: 8, marginTop: 4},
  sectionItemCard: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  sectionItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionName: {fontSize: 13, fontFamily: FONTS.bold},
  secScoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  secScoreText: {fontSize: 11, fontFamily: FONTS.bold},
  naBadge: {
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  naText: {color: '#9CA3AF', fontSize: 10, fontFamily: FONTS.medium},
  secFeedbackText: {fontSize: 12, fontFamily: FONTS.regular, lineHeight: 17},
  subPillSection: {marginTop: SPACING.sm},
  subPillHeader: {fontSize: 10, fontFamily: FONTS.bold, letterSpacing: 0.5, marginBottom: 4},
  bulletRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginVertical: 3},
  bulletText: {flex: 1, fontSize: 12, fontFamily: FONTS.regular, lineHeight: 17},
  goldHeader: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6},
  goldTitle: {fontSize: 13, fontFamily: FONTS.bold},
  goldScriptBody: {fontSize: 13, fontFamily: FONTS.regular, lineHeight: 19, fontStyle: 'italic'},
  floatingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingTop: 10,
    paddingHorizontal: SPACING.md,
    borderTopWidth: 1,
    gap: 10,
  },
  discardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 6,
  },
  discardBtnText: {color: '#EF4444', fontSize: 13, fontFamily: FONTS.semiBold},
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  saveBtnText: {color: '#FFFFFF', fontSize: 14, fontFamily: FONTS.bold},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  savedModalBox: {
    width: '100%',
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: 'center',
  },
  savedModalTitle: {fontSize: 17, fontFamily: FONTS.bold, marginTop: SPACING.sm, textAlign: 'center'},
  savedModalSub: {fontSize: 12, fontFamily: FONTS.regular, textAlign: 'center', marginTop: 4, lineHeight: 17},
  shareModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 6,
    marginVertical: SPACING.md,
  },
  shareModalText: {fontSize: 12, fontFamily: FONTS.semiBold},
  savedModalDoneBtn: {width: '100%', paddingVertical: 12, borderRadius: RADIUS.md, alignItems: 'center'},
  savedModalDoneText: {color: '#FFFFFF', fontSize: 13, fontFamily: FONTS.bold},
  modalBtnRow: {flexDirection: 'row', gap: 10, width: '100%', marginTop: SPACING.md},
  modalSecBtn: {flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, alignItems: 'center'},
  modalSecText: {fontSize: 12, fontFamily: FONTS.medium},
  modalPriBtn: {flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, alignItems: 'center'},
  modalPriText: {color: '#FFFFFF', fontSize: 12, fontFamily: FONTS.semiBold},
});

export default PitchTrainerFeedbackScreen;
