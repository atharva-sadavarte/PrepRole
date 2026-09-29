import React, {useState, useEffect} from 'react';
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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../context/ThemeContext';
import {SPACING, RADIUS, FONTS} from '../../lib/theme';
import Icon from '../../components/Icon';
import type {Session} from '@supabase/supabase-js';
import {
  PersonalPitch,
  MAX_PERSONAL_PITCHES,
} from '../../types/pitchTrainer';
import {
  getPersonalPitches,
  getPitchDraft,
  getSavedPitches,
  deletePitch,
} from '../../services/pitchTrainerService';
import {AVAILABLE_LANGUAGES} from '../../types/interviewCoach';

interface PersonalPitchTrainerScreenProps {
  navigation: any;
  session: Session;
}

export const PersonalPitchTrainerScreen: React.FC<PersonalPitchTrainerScreenProps> = ({
  navigation,
  session,
}) => {
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();
  const userId = session?.user?.id || 'guest_user';

  // State
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [showLangModal, setShowLangModal] = useState(false);
  const [draftPitch, setDraftPitch] = useState<PersonalPitch | null>(null);
  const [savedPitches, setSavedPitches] = useState<PersonalPitch[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals for Create CTA gating
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showMaxPitchesModal, setShowMaxPitchesModal] = useState(false);
  const [showLangConfirmModal, setShowLangConfirmModal] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadPitches();
    });
    loadPitches();
    return unsubscribe;
  }, [navigation]);

  const loadPitches = async () => {
    setLoading(true);
    const draft = await getPitchDraft(userId);
    const saved = await getSavedPitches(userId);
    setDraftPitch(draft);
    setSavedPitches(saved);
    setLoading(false);
  };

  // Rule PT-2, PT-3, PT-4: Create Pitch CTA gating
  const handleCreatePitchPress = () => {
    // 1. If draft exists: offer Resume or Start New
    if (draftPitch) {
      setShowResumeModal(true);
      return;
    }

    // 2. If 5 or more personal pitches: stop user
    if (savedPitches.length >= MAX_PERSONAL_PITCHES) {
      setShowMaxPitchesModal(true);
      return;
    }

    // 3. If first pitch in this language
    const pitchesInLang = savedPitches.filter(p => p.language === selectedLanguage);
    if (pitchesInLang.length === 0) {
      setShowLangConfirmModal(true);
      return;
    }

    // Proceed to create screen
    navigation.navigate('PitchTrainerCreate', {
      language: selectedLanguage,
    });
  };

  const handleResumeDraft = () => {
    setShowResumeModal(false);
    if (draftPitch) {
      navigation.navigate('PitchTrainerRecord', {
        pitchId: draftPitch.id,
        jobRole: draftPitch.jobRole,
        notes: draftPitch.notes,
        language: draftPitch.language,
      });
    }
  };

  const handleStartNewDiscardDraft = async () => {
    setShowResumeModal(false);
    if (draftPitch) {
      await deletePitch(userId, draftPitch.id);
      setDraftPitch(null);
    }
    // Now check if max reached
    if (savedPitches.length >= MAX_PERSONAL_PITCHES) {
      setShowMaxPitchesModal(true);
      return;
    }
    navigation.navigate('PitchTrainerCreate', {
      language: selectedLanguage,
    });
  };

  const handleDeletePitch = (pitchId: string) => {
    Alert.alert(
      'Delete Pitch',
      'Are you sure you want to delete this saved pitch? This cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deletePitch(userId, pitchId);
            loadPitches();
          },
        },
      ],
    );
  };

  const handleViewPitch = (pitch: PersonalPitch) => {
    navigation.navigate('PitchTrainerFeedback', {
      pitchId: pitch.id,
      jobRole: pitch.jobRole,
      isView: true,
      initialPitch: pitch,
    });
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
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
            Personal Pitch Trainer
          </Text>
          <Text style={[styles.headerSubtitle, {color: colors.textSecondary}]}>
            6-Part Elevator Pitch & AI Video Analysis
          </Text>
        </View>

        {/* Language Pill */}
        <TouchableOpacity
          onPress={() => setShowLangModal(true)}
          style={[
            styles.langPill,
            {backgroundColor: colors.bgCard, borderColor: colors.border},
          ]}
          activeOpacity={0.75}>
          <Icon name="globe-outline" size={14} color={colors.primaryStart} />
          <Text style={[styles.langPillText, {color: colors.textPrimary}]}>
            {selectedLanguage.split('-')[0].toUpperCase()}
          </Text>
          <Icon name="chevron-down" size={12} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: Math.max(insets.bottom, 20) + 90},
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <LinearGradient
          colors={['#2E1E3B', '#1E1528', '#140D1C']}
          style={[styles.heroBanner, {borderColor: colors.border}]}>
          <View style={styles.bannerBadge}>
            <Icon name="videocam" size={14} color="#D8B4FE" />
            <Text style={styles.bannerBadgeText}>Executive Presence & Pitch Scoring</Text>
          </View>
          <Text style={[styles.bannerTitle, {color: colors.textPrimary}]}>
            Craft & Deliver Your Winning 90-Second Pitch
          </Text>
          <Text style={[styles.bannerDesc, {color: colors.textSecondary}]}>
            Follow the proven 6-part pitch architecture (Intro, Goals, Work Experience, Skills, Achievements, Conclusion) with multi-attribute AI scoring.
          </Text>
        </LinearGradient>

        {/* Draft Card (Rule PT-3) */}
        {draftPitch && (
          <View
            style={[
              styles.draftCard,
              {
                backgroundColor: isDark ? '#1F1B24' : '#FAF5FF',
                borderColor: '#A855F7',
              },
            ]}>
            <View style={styles.draftTop}>
              <View style={styles.draftBadge}>
                <Text style={styles.draftBadgeText}>UNFINISHED DRAFT</Text>
              </View>
              <Text style={[styles.draftDate, {color: colors.textMuted}]}>
                Last edited {formatDate(draftPitch.updatedAt)}
              </Text>
            </View>
            <Text style={[styles.draftRole, {color: colors.textPrimary}]}>
              Target Role: {draftPitch.jobRole}
            </Text>
            <Text style={[styles.draftSub, {color: colors.textSecondary}]}>
              You have an active recording draft ready to continue.
            </Text>
            <View style={styles.draftBtnRow}>
              <TouchableOpacity
                style={[styles.draftResumeBtn, {backgroundColor: '#A855F7'}]}
                onPress={handleResumeDraft}
                activeOpacity={0.85}>
                <Icon name="play" size={14} color="#FFFFFF" />
                <Text style={styles.draftResumeBtnText}>Resume Draft</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.draftDiscardBtn, {borderColor: colors.border}]}
                onPress={async () => {
                  await deletePitch(userId, draftPitch.id);
                  setDraftPitch(null);
                }}>
                <Text style={[styles.draftDiscardBtnText, {color: colors.textSecondary}]}>
                  Discard
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Sample Pitch Guidance (Rule PT-5: shown until at least 1 saved pitch) */}
        {savedPitches.length === 0 && (
          <View
            style={[
              styles.sampleCard,
              {backgroundColor: colors.bgCard, borderColor: colors.border},
            ]}>
            <View style={styles.sampleCardHeader}>
              <Icon name="bulb" size={20} color="#F59E0B" />
              <Text style={[styles.sampleCardTitle, {color: colors.textPrimary}]}>
                The 6-Part Pitch Formula
              </Text>
            </View>
            <Text style={[styles.sampleCardBody, {color: colors.textSecondary}]}>
              1. <Text style={{fontFamily: FONTS.bold}}>Introduction:</Text> Who you are and your focus.{'\n'}
              2. <Text style={{fontFamily: FONTS.bold}}>Goals:</Text> Your target role and ambition.{'\n'}
              3. <Text style={{fontFamily: FONTS.bold}}>Work Experience:</Text> Past roles or relevant projects.{'\n'}
              4. <Text style={{fontFamily: FONTS.bold}}>Skills:</Text> Top 3 core technologies and strengths.{'\n'}
              5. <Text style={{fontFamily: FONTS.bold}}>Achievements:</Text> Quantified results or impact.{'\n'}
              6. <Text style={{fontFamily: FONTS.bold}}>Conclusion:</Text> High-energy closing and call to action.
            </Text>
          </View>
        )}

        {/* Saved Pitches List (Rule PT-2: max 5 pitches) */}
        <View style={styles.savedSection}>
          <View style={styles.savedSectionHeader}>
            <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
              Saved Pitches
            </Text>
            <Text style={[styles.limitCounter, {color: colors.textMuted}]}>
              {savedPitches.length} / {MAX_PERSONAL_PITCHES} Slots Used
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={colors.primaryStart} style={{marginTop: 20}} />
          ) : savedPitches.length === 0 ? (
            <View
              style={[
                styles.emptyBox,
                {backgroundColor: colors.bgCard, borderColor: colors.border},
              ]}>
              <Icon name="mic-outline" size={36} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, {color: colors.textPrimary}]}>
                No saved pitches yet
              </Text>
              <Text style={[styles.emptySub, {color: colors.textSecondary}]}>
                Tap "Create Pitch" below to record your personal elevator pitch and receive comprehensive AI feedback.
              </Text>
            </View>
          ) : (
            savedPitches.map(pitch => (
              <View
                key={pitch.id}
                style={[
                  styles.pitchCard,
                  {backgroundColor: colors.bgCard, borderColor: colors.border},
                ]}>
                <View style={styles.pitchCardTop}>
                  <View style={{flex: 1}}>
                    <Text style={[styles.pitchRole, {color: colors.textPrimary}]}>
                      {pitch.jobRole}
                    </Text>
                    <Text style={[styles.pitchDate, {color: colors.textMuted}]}>
                      {formatDate(pitch.createdAt)} • {pitch.durationSeconds}s duration
                    </Text>
                  </View>

                  {/* Emoji Band & Score */}
                  <View
                    style={[
                      styles.scoreBandPill,
                      {
                        backgroundColor: isDark ? '#1C1917' : '#FEF3C7',
                        borderColor: '#F59E0B',
                      },
                    ]}>
                    <Text style={styles.scoreBandEmoji}>
                      {pitch.analysis?.scoreBandEmoji || '🌟'}
                    </Text>
                    <Text style={[styles.scoreBandScore, {color: isDark ? '#FDE68A' : '#92400E'}]}>
                      {pitch.analysis?.overallRating.toFixed(1) || '4.0'} / 5
                    </Text>
                  </View>
                </View>

                <View style={styles.pitchCardBottom}>
                  <Text style={[styles.bandLabelText, {color: colors.textSecondary}]}>
                    {pitch.analysis?.scoreBandLabel || 'Executive Ready'}
                  </Text>
                  <View style={styles.pitchBtnGroup}>
                    <TouchableOpacity
                      onPress={() => handleDeletePitch(pitch.id)}
                      hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                      <Icon name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.viewPitchBtn, {backgroundColor: colors.primaryStart}]}
                      onPress={() => handleViewPitch(pitch)}
                      activeOpacity={0.8}>
                      <Text style={styles.viewPitchBtnText}>View</Text>
                      <Icon name="arrow-forward" size={13} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Floating Create Pitch CTA Bar */}
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
          style={[styles.createCtaBtn, {backgroundColor: colors.primaryStart}]}
          onPress={handleCreatePitchPress}
          activeOpacity={0.85}>
          <Icon name="add-circle" size={20} color="#FFFFFF" />
          <Text style={styles.createCtaText}>Create Pitch</Text>
        </TouchableOpacity>
      </View>

      {/* Modal 1: Resume Draft Modal (Rule PT-3) */}
      <Modal visible={showResumeModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.promptModal,
              {backgroundColor: colors.bgCard, borderColor: colors.border},
            ]}>
            <Icon name="document-text-outline" size={32} color="#A855F7" />
            <Text style={[styles.promptModalTitle, {color: colors.textPrimary}]}>
              Existing Draft Found
            </Text>
            <Text style={[styles.promptModalBody, {color: colors.textSecondary}]}>
              You have an unfinished draft for "{draftPitch?.jobRole}". Would you like to resume where you left off or start a brand new pitch? (Starting new will delete the draft).
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalSecondaryBtn, {borderColor: colors.border}]}
                onPress={handleStartNewDiscardDraft}>
                <Text style={[styles.modalSecondaryBtnText, {color: '#EF4444'}]}>
                  Start New
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, {backgroundColor: colors.primaryStart}]}
                onPress={handleResumeDraft}>
                <Text style={styles.modalPrimaryBtnText}>Resume Draft</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal 2: Max Pitches Modal (Rule PT-2) */}
      <Modal visible={showMaxPitchesModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.promptModal,
              {backgroundColor: colors.bgCard, borderColor: colors.border},
            ]}>
            <Icon name="alert-circle-outline" size={36} color="#EF4444" />
            <Text style={[styles.promptModalTitle, {color: colors.textPrimary}]}>
              Maximum Pitches Reached (5/5)
            </Text>
            <Text style={[styles.promptModalBody, {color: colors.textSecondary}]}>
              You have stored 5 personal pitches. To record a new pitch, please delete an older pitch from your list above.
            </Text>
            <TouchableOpacity
              style={[styles.modalPrimaryBtn, {backgroundColor: colors.primaryStart, width: '100%'}]}
              onPress={() => setShowMaxPitchesModal(false)}>
              <Text style={styles.modalPrimaryBtnText}>Understood</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal 3: Language Confirm Modal (Rule PT-4) */}
      <Modal visible={showLangConfirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.promptModal,
              {backgroundColor: colors.bgCard, borderColor: colors.border},
            ]}>
            <Icon name="globe-outline" size={32} color={colors.primaryStart} />
            <Text style={[styles.promptModalTitle, {color: colors.textPrimary}]}>
              Confirm Pitch Language
            </Text>
            <Text style={[styles.promptModalBody, {color: colors.textSecondary}]}>
              Your pitch audio transcription and AI analysis will be processed in {selectedLanguage}. You can change languages at any time.
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalSecondaryBtn, {borderColor: colors.border}]}
                onPress={() => setShowLangConfirmModal(false)}>
                <Text style={[styles.modalSecondaryBtnText, {color: colors.textSecondary}]}>
                  Change
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, {backgroundColor: colors.primaryStart}]}
                onPress={() => {
                  setShowLangConfirmModal(false);
                  navigation.navigate('PitchTrainerCreate', {
                    language: selectedLanguage,
                  });
                }}>
                <Text style={styles.modalPrimaryBtnText}>Confirm & Start</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Language Picker Modal */}
      <Modal visible={showLangModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLangModal(false)}>
          <View
            style={[
              styles.langModalContent,
              {backgroundColor: colors.bgCard, borderColor: colors.border},
            ]}>
            <Text style={[styles.modalTitle, {color: colors.textPrimary}]}>
              Pitch Language
            </Text>
            {AVAILABLE_LANGUAGES.map(lang => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.langItem,
                  {borderColor: colors.border},
                  selectedLanguage === lang.code && {
                    backgroundColor: colors.accentSoft,
                    borderColor: colors.primaryStart,
                  },
                ]}
                onPress={() => {
                  setSelectedLanguage(lang.code);
                  setShowLangModal(false);
                }}>
                <Text
                  style={[
                    styles.langItemText,
                    {
                      color:
                        selectedLanguage === lang.code
                          ? colors.primaryStart
                          : colors.textPrimary,
                    },
                  ]}>
                  {lang.label}
                </Text>
                {selectedLanguage === lang.code && (
                  <Icon name="checkmark" size={18} color={colors.primaryStart} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
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
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 4,
  },
  langPillText: {fontSize: 12, fontFamily: FONTS.semiBold},
  scroll: {flex: 1},
  scrollContent: {padding: SPACING.md},
  heroBanner: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.xs,
  },
  bannerBadgeText: {fontSize: 12, fontFamily: FONTS.semiBold, color: '#D8B4FE'},
  bannerTitle: {fontSize: 20, fontFamily: FONTS.bold, marginBottom: SPACING.xs},
  bannerDesc: {fontSize: 13, fontFamily: FONTS.regular, lineHeight: 18},
  draftCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    marginBottom: SPACING.md,
  },
  draftTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  draftBadge: {
    backgroundColor: '#9333EA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  draftBadgeText: {color: '#FFFFFF', fontSize: 10, fontFamily: FONTS.bold},
  draftDate: {fontSize: 11, fontFamily: FONTS.regular},
  draftRole: {fontSize: 15, fontFamily: FONTS.bold, marginBottom: 2},
  draftSub: {fontSize: 12, fontFamily: FONTS.regular, marginBottom: SPACING.sm},
  draftBtnRow: {flexDirection: 'row', gap: 10},
  draftResumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  draftResumeBtnText: {color: '#FFFFFF', fontSize: 12, fontFamily: FONTS.semiBold},
  draftDiscardBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    justifyContent: 'center',
  },
  draftDiscardBtnText: {fontSize: 12, fontFamily: FONTS.medium},
  sampleCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  sampleCardHeader: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8},
  sampleCardTitle: {fontSize: 14, fontFamily: FONTS.bold},
  sampleCardBody: {fontSize: 12, fontFamily: FONTS.regular, lineHeight: 18},
  savedSection: {marginTop: SPACING.xs},
  savedSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {fontSize: 16, fontFamily: FONTS.bold},
  limitCounter: {fontSize: 12, fontFamily: FONTS.medium},
  emptyBox: {
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyTitle: {fontSize: 15, fontFamily: FONTS.bold, marginTop: SPACING.sm},
  emptySub: {fontSize: 12, fontFamily: FONTS.regular, textAlign: 'center', marginTop: 4, lineHeight: 17},
  pitchCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  pitchCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  pitchRole: {fontSize: 15, fontFamily: FONTS.bold},
  pitchDate: {fontSize: 11, fontFamily: FONTS.regular, marginTop: 2},
  scoreBandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 4,
  },
  scoreBandEmoji: {fontSize: 14},
  scoreBandScore: {fontSize: 12, fontFamily: FONTS.bold},
  pitchCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bandLabelText: {fontSize: 12, fontFamily: FONTS.regular},
  pitchBtnGroup: {flexDirection: 'row', alignItems: 'center', gap: 12},
  viewPitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  viewPitchBtnText: {color: '#FFFFFF', fontSize: 11, fontFamily: FONTS.semiBold},
  floatingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 10,
    paddingHorizontal: SPACING.md,
    borderTopWidth: 1,
  },
  createCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    gap: 8,
  },
  createCtaText: {color: '#FFFFFF', fontSize: 15, fontFamily: FONTS.bold},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  promptModal: {
    width: '100%',
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: 'center',
  },
  promptModalTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  promptModalBody: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    textAlign: 'center',
    lineHeight: 18,
    marginVertical: SPACING.md,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  modalSecondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalSecondaryBtnText: {fontSize: 13, fontFamily: FONTS.medium},
  modalPrimaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  modalPrimaryBtnText: {color: '#FFFFFF', fontSize: 13, fontFamily: FONTS.semiBold},
  langModalContent: {
    width: '100%',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  modalTitle: {fontSize: 17, fontFamily: FONTS.bold, marginBottom: 12},
  langItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: 8,
  },
  langItemText: {fontSize: 14},
});

export default PersonalPitchTrainerScreen;
