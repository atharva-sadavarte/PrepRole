import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../context/ThemeContext';
import {SPACING, RADIUS, FONTS} from '../../lib/theme';
import Icon from '../../components/Icon';
import type {Session} from '@supabase/supabase-js';
import {
  PITCH_SECTIONS,
  PitchSectionKey,
  PitchNotes,
} from '../../types/pitchTrainer';
import {
  validatePitchJobRole,
  createPitchDraft,
  updatePitch,
  getPreviousRoles,
  getLocalNotesDraft,
  saveLocalNotesDraft,
  INITIAL_PITCH_NOTES,
} from '../../services/pitchTrainerService';

interface PitchTrainerCreateScreenProps {
  route: {
    params: {
      language: string;
      returnToRecord?: boolean;
      existingPitchId?: string;
      initialJobRole?: string;
      initialNotes?: PitchNotes;
    };
  };
  navigation: any;
  session: Session;
}

export const PitchTrainerCreateScreen: React.FC<PitchTrainerCreateScreenProps> = ({
  route,
  navigation,
  session,
}) => {
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();
  const userId = session?.user?.id || 'guest_user';
  const language = route.params?.language || 'en-US';

  // Job Role state
  const [jobRoleInput, setJobRoleInput] = useState(route.params?.initialJobRole || '');
  const [isValidated, setIsValidated] = useState(!!route.params?.initialJobRole);
  const [isValidatingRole, setIsValidatingRole] = useState(false);
  const [previousRoles, setPreviousRoles] = useState<string[]>([]);

  // Notes state (6 tabs)
  const [activeTabKey, setActiveTabKey] = useState<PitchSectionKey>('introduction');
  const [notes, setNotes] = useState<PitchNotes>(
    route.params?.initialNotes || {...INITIAL_PITCH_NOTES},
  );

  // Draft ID if created
  const [pitchId, setPitchId] = useState<string | null>(route.params?.existingPitchId || null);

  // Modals
  const [showPreTipsModal, setShowPreTipsModal] = useState(false);
  const [showLeaveGuardModal, setShowLeaveGuardModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    const roles = await getPreviousRoles(userId);
    setPreviousRoles(roles);

    if (!route.params?.initialNotes) {
      const local = await getLocalNotesDraft(language);
      setNotes(local);
    }
  };

  // Rule PT-6: Editing role clears validated state
  const handleRoleChange = (text: string) => {
    setJobRoleInput(text);
    setIsValidated(false);
  };

  // Rule PT-6, PT-7: Validate job role
  const handleValidateRole = async () => {
    if (!jobRoleInput.trim()) {
      Alert.alert('Role Required', 'Please enter your target job role.');
      return;
    }

    setIsValidatingRole(true);
    const result = await validatePitchJobRole(jobRoleInput, 'India');
    setIsValidatingRole(false);

    if (result.valid) {
      setJobRoleInput(result.normalizedRole);
      setIsValidated(true);
      // Auto-save/create draft on valid role (Rule PT-12)
      await syncDraft(result.normalizedRole, notes);
    } else {
      Alert.alert('Invalid Job Title', result.reason || 'Please enter a valid career title.');
    }
  };

  const handleSelectPreviousRole = (role: string) => {
    setJobRoleInput(role);
    setIsValidated(false);
  };

  // Update note text for active tab
  const handleNoteTextChange = (text: string) => {
    const updated = {
      ...notes,
      [activeTabKey]: text,
    };
    setNotes(updated);
    saveLocalNotesDraft(language, updated);
  };

  // Sync draft to server
  const syncDraft = async (role: string, currentNotes: PitchNotes) => {
    if (!pitchId) {
      const draft = await createPitchDraft(userId, role, language, currentNotes);
      setPitchId(draft.id);
      return draft.id;
    } else {
      await updatePitch(userId, pitchId, {
        jobRole: role,
        notes: currentNotes,
      });
      return pitchId;
    }
  };

  // Save & Next button
  const handleSaveAndNext = async () => {
    setIsSaving(true);
    await saveLocalNotesDraft(language, notes);
    if (isValidated) {
      await syncDraft(jobRoleInput, notes);
    }
    setIsSaving(false);

    // Advance to next section tab
    const currentIndex = PITCH_SECTIONS.findIndex(s => s.key === activeTabKey);
    if (currentIndex < PITCH_SECTIONS.length - 1) {
      setActiveTabKey(PITCH_SECTIONS[currentIndex + 1].key);
    } else {
      handleCreatePitch();
    }
  };

  // Create Pitch button (Rule PT-12: creates draft, opens tips modal)
  const handleCreatePitch = async () => {
    if (!isValidated) {
      if (!jobRoleInput.trim()) {
        Alert.alert('Job Role Required', 'Please enter and validate your target job title.');
        return;
      }
      // Validate automatically
      setIsValidatingRole(true);
      const res = await validatePitchJobRole(jobRoleInput, 'India');
      setIsValidatingRole(false);
      if (!res.valid) {
        Alert.alert('Invalid Job Role', res.reason || 'Please enter a recognized job title.');
        return;
      }
      setJobRoleInput(res.normalizedRole);
      setIsValidated(true);
      const id = await syncDraft(res.normalizedRole, notes);
      setPitchId(id);
    } else {
      await syncDraft(jobRoleInput, notes);
    }

    setShowPreTipsModal(true);
  };

  // Confirm tips & navigate to recording
  const handleProceedToRecord = () => {
    setShowPreTipsModal(false);
    navigation.navigate('PitchTrainerRecord', {
      pitchId: pitchId || `local-pitch-${Date.now()}`,
      jobRole: jobRoleInput,
      notes,
      language,
    });
  };

  // Leave guard (Rule PT-13: Save & Exit / Stay)
  const handleBackWithGuard = () => {
    const hasNotes = Object.values(notes).some(n => n.trim().length > 0);
    if (isValidated || hasNotes) {
      setShowLeaveGuardModal(true);
    } else {
      navigation.goBack();
    }
  };

  const handleSaveAndExit = async () => {
    setShowLeaveGuardModal(false);
    await saveLocalNotesDraft(language, notes);
    if (isValidated) {
      await syncDraft(jobRoleInput, notes);
    }
    navigation.goBack();
  };

  const currentSection = PITCH_SECTIONS.find(s => s.key === activeTabKey)!;
  const currentNoteContent = notes[activeTabKey] || '';

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
          onPress={handleBackWithGuard}
          style={[styles.backBtn, {backgroundColor: colors.bgCard, borderColor: colors.border}]}
          activeOpacity={0.7}>
          <Icon name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
            Prepare Your Pitch
          </Text>
          <Text style={[styles.headerSubtitle, {color: colors.textSecondary}]}>
            Target Role & Guided 6-Part Notes
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: Math.max(insets.bottom, 20) + 90},
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Section 1: Target Job Role Card */}
        <View
          style={[
            styles.card,
            {backgroundColor: colors.bgCard, borderColor: colors.border},
          ]}>
          <Text style={[styles.cardTitle, {color: colors.textPrimary}]}>
            1. Target Job Role
          </Text>
          <Text style={[styles.cardSub, {color: colors.textSecondary}]}>
            The role you are pitching for. AI feedback evaluates relevance against this.
          </Text>

          <View style={styles.roleInputRow}>
            <TextInput
              style={[
                styles.roleInput,
                {
                  color: colors.textPrimary,
                  backgroundColor: isDark ? '#18181B' : '#F4F4F5',
                  borderColor: isValidated ? '#10B981' : colors.border,
                },
              ]}
              placeholder="e.g. Lead React Native Engineer"
              placeholderTextColor={colors.textMuted}
              value={jobRoleInput}
              onChangeText={handleRoleChange}
              onSubmitEditing={handleValidateRole}
            />
            <TouchableOpacity
              style={[
                styles.validateBtn,
                {backgroundColor: isValidated ? '#10B981' : colors.primaryStart},
              ]}
              onPress={handleValidateRole}
              disabled={isValidatingRole}
              activeOpacity={0.8}>
              {isValidatingRole ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Icon
                  name={isValidated ? 'checkmark' : 'arrow-forward'}
                  size={18}
                  color="#FFFFFF"
                />
              )}
            </TouchableOpacity>
          </View>

          {isValidated && (
            <View style={styles.validBadge}>
              <Icon name="checkmark-circle" size={14} color="#10B981" />
              <Text style={styles.validText}>Validated & Normalized Title</Text>
            </View>
          )}

          {/* Previous Role Suggestions (Rule PT-8) */}
          {previousRoles.length > 0 && (
            <View style={styles.prevRolesWrap}>
              <Text style={[styles.prevRoleLabel, {color: colors.textMuted}]}>
                PAST TARGET ROLES:
              </Text>
              <View style={styles.chipRow}>
                {previousRoles.map((r, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.roleChip,
                      {borderColor: colors.border, backgroundColor: colors.accentSoft},
                    ]}
                    onPress={() => handleSelectPreviousRole(r)}>
                    <Text style={[styles.roleChipText, {color: colors.primaryStart}]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Section 2: 6-Part Pitch Notes Card (Rule PT-9, PT-10) */}
        <View
          style={[
            styles.card,
            {backgroundColor: colors.bgCard, borderColor: colors.border},
          ]}>
          <Text style={[styles.cardTitle, {color: colors.textPrimary}]}>
            2. Structured Notes (6 Tabs)
          </Text>
          <Text style={[styles.cardSub, {color: colors.textSecondary}]}>
            Prepare bullet points to guide your speech. You can view these while recording.
          </Text>

          {/* Horizontal Section Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsContainer}>
            {PITCH_SECTIONS.map((sec, idx) => {
              const isActive = sec.key === activeTabKey;
              const hasContent = (notes[sec.key] || '').trim().length > 0;
              return (
                <TouchableOpacity
                  key={sec.key}
                  style={[
                    styles.tabPill,
                    {
                      borderColor: isActive ? colors.primaryStart : colors.border,
                      backgroundColor: isActive ? colors.accentSoft : 'transparent',
                    },
                  ]}
                  onPress={() => setActiveTabKey(sec.key)}>
                  <Text
                    style={[
                      styles.tabPillText,
                      {
                        color: isActive ? colors.primaryStart : colors.textSecondary,
                        fontFamily: isActive ? FONTS.bold : FONTS.regular,
                      },
                    ]}>
                    {idx + 1}. {sec.title}
                  </Text>
                  {hasContent && (
                    <View style={[styles.dotFilled, {backgroundColor: '#10B981'}]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Active Tab Guidance */}
          <View
            style={[
              styles.guidanceBox,
              {backgroundColor: isDark ? '#1C1917' : '#FEF3C7', borderColor: '#F59E0B'},
            ]}>
            <Icon name="information-circle" size={16} color="#D97706" />
            <Text style={[styles.guidanceText, {color: isDark ? '#FDE68A' : '#92400E'}]}>
              {currentSection.promptGuidance}
            </Text>
          </View>

          {/* Notes Rich Text Area */}
          <TextInput
            style={[
              styles.notesInput,
              {
                color: colors.textPrimary,
                backgroundColor: isDark ? '#18181B' : '#F4F4F5',
                borderColor: colors.border,
              },
            ]}
            multiline
            placeholder={currentSection.placeholder}
            placeholderTextColor={colors.textMuted}
            value={currentNoteContent}
            onChangeText={handleNoteTextChange}
          />

          <View style={styles.notesFooterRow}>
            <Text style={[styles.tabCounterText, {color: colors.textMuted}]}>
              Tab {PITCH_SECTIONS.findIndex(s => s.key === activeTabKey) + 1} of 6
            </Text>
            <TouchableOpacity
              style={[styles.saveNextBtn, {borderColor: colors.border}]}
              onPress={handleSaveAndNext}
              disabled={isSaving}
              activeOpacity={0.8}>
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.primaryStart} />
              ) : (
                <>
                  <Text style={[styles.saveNextText, {color: colors.textPrimary}]}>
                    {PITCH_SECTIONS.findIndex(s => s.key === activeTabKey) === 5
                      ? 'Finish Notes'
                      : 'Save & Next'}
                  </Text>
                  <Icon name="arrow-forward" size={14} color={colors.textPrimary} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Floating Bottom Bar: Create Pitch CTA */}
      <View
        style={[
          styles.bottomFloatingBar,
          {
            backgroundColor: colors.bgDark,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 14),
          },
        ]}>
        <TouchableOpacity
          style={[styles.startRecordBtn, {backgroundColor: colors.primaryStart}]}
          onPress={handleCreatePitch}
          activeOpacity={0.85}>
          <Icon name="videocam" size={20} color="#FFFFFF" />
          <Text style={styles.startRecordText}>Create Pitch & Record</Text>
        </TouchableOpacity>
      </View>

      {/* Pre-Pitch Tips Modal */}
      <Modal visible={showPreTipsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.tipsModalContent,
              {backgroundColor: colors.bgCard, borderColor: colors.border},
            ]}>
            <Icon name="sparkles" size={32} color={colors.primaryStart} />
            <Text style={[styles.tipsModalTitle, {color: colors.textPrimary}]}>
              Recording Tips
            </Text>
            <Text style={[styles.tipsModalSub, {color: colors.textSecondary}]}>
              Get ready to deliver your winning pitch:
            </Text>

            <View style={styles.tipList}>
              <View style={styles.tipItem}>
                <Icon name="checkmark" size={16} color="#10B981" />
                <Text style={[styles.tipText, {color: colors.textPrimary}]}>
                  <Text style={{fontFamily: FONTS.bold}}>Duration:</Text> Between 15s and 180s.
                </Text>
              </View>
              <View style={styles.tipItem}>
                <Icon name="checkmark" size={16} color="#10B981" />
                <Text style={[styles.tipText, {color: colors.textPrimary}]}>
                  <Text style={{fontFamily: FONTS.bold}}>Camera/Mic:</Text> Video or audio mode available.
                </Text>
              </View>
              <View style={styles.tipItem}>
                <Icon name="checkmark" size={16} color="#10B981" />
                <Text style={[styles.tipText, {color: colors.textPrimary}]}>
                  <Text style={{fontFamily: FONTS.bold}}>Teleprompter:</Text> Access your notes while speaking.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.tipsConfirmBtn, {backgroundColor: colors.primaryStart}]}
              onPress={handleProceedToRecord}
              activeOpacity={0.85}>
              <Text style={styles.tipsConfirmText}>I'm Ready • Launch Studio</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Leave Guard Modal (Rule PT-13) */}
      <Modal visible={showLeaveGuardModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.tipsModalContent,
              {backgroundColor: colors.bgCard, borderColor: colors.border},
            ]}>
            <Icon name="save-outline" size={32} color="#F59E0B" />
            <Text style={[styles.tipsModalTitle, {color: colors.textPrimary}]}>
              Save Work Before Leaving?
            </Text>
            <Text style={[styles.tipsModalSub, {color: colors.textSecondary}]}>
              Save your draft so you can resume this pitch anytime without losing progress.
            </Text>
            <View style={styles.leaveModalBtnRow}>
              <TouchableOpacity
                style={[styles.leaveSecondaryBtn, {borderColor: colors.border}]}
                onPress={() => {
                  setShowLeaveGuardModal(false);
                  navigation.goBack();
                }}>
                <Text style={[styles.leaveSecondaryText, {color: '#EF4444'}]}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.leavePrimaryBtn, {backgroundColor: colors.primaryStart}]}
                onPress={handleSaveAndExit}>
                <Text style={styles.leavePrimaryText}>Save & Exit</Text>
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
  card: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  cardTitle: {fontSize: 15, fontFamily: FONTS.bold},
  cardSub: {fontSize: 12, fontFamily: FONTS.regular, marginTop: 2, marginBottom: SPACING.sm},
  roleInputRow: {flexDirection: 'row', gap: 8},
  roleInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: FONTS.regular,
  },
  validateBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  validText: {fontSize: 11, fontFamily: FONTS.semiBold, color: '#10B981'},
  prevRolesWrap: {marginTop: SPACING.sm},
  prevRoleLabel: {fontSize: 10, fontFamily: FONTS.bold, letterSpacing: 0.5, marginBottom: 4},
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  roleChipText: {fontSize: 11, fontFamily: FONTS.medium},
  tabsScroll: {marginVertical: SPACING.xs},
  tabsContainer: {gap: 6, paddingVertical: 4},
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 6,
  },
  tabPillText: {fontSize: 12},
  dotFilled: {width: 6, height: 6, borderRadius: 3},
  guidanceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 6,
    marginVertical: SPACING.sm,
  },
  guidanceText: {flex: 1, fontSize: 11, fontFamily: FONTS.medium},
  notesInput: {
    minHeight: 120,
    maxHeight: 180,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontSize: 13,
    fontFamily: FONTS.regular,
    lineHeight: 19,
    textAlignVertical: 'top',
  },
  notesFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  tabCounterText: {fontSize: 11, fontFamily: FONTS.regular},
  saveNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 4,
  },
  saveNextText: {fontSize: 12, fontFamily: FONTS.semiBold},
  bottomFloatingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 10,
    paddingHorizontal: SPACING.md,
    borderTopWidth: 1,
  },
  startRecordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    gap: 8,
  },
  startRecordText: {color: '#FFFFFF', fontSize: 15, fontFamily: FONTS.bold},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  tipsModalContent: {
    width: '100%',
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: 'center',
  },
  tipsModalTitle: {fontSize: 17, fontFamily: FONTS.bold, marginTop: SPACING.sm},
  tipsModalSub: {fontSize: 12, fontFamily: FONTS.regular, textAlign: 'center', marginTop: 4, marginBottom: SPACING.md},
  tipList: {width: '100%', gap: 8, marginBottom: SPACING.lg},
  tipItem: {flexDirection: 'row', alignItems: 'center', gap: 8},
  tipText: {fontSize: 13, fontFamily: FONTS.regular},
  tipsConfirmBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  tipsConfirmText: {color: '#FFFFFF', fontSize: 14, fontFamily: FONTS.semiBold},
  leaveModalBtnRow: {flexDirection: 'row', gap: 10, width: '100%', marginTop: SPACING.md},
  leaveSecondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  leaveSecondaryText: {fontSize: 13, fontFamily: FONTS.medium},
  leavePrimaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  leavePrimaryText: {color: '#FFFFFF', fontSize: 13, fontFamily: FONTS.semiBold},
});

export default PitchTrainerCreateScreen;
