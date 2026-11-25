import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../context/ThemeContext';
import {FONTS, ICON_SIZES, RADIUS, SHADOWS, SPACING} from '../lib/theme';
import {CVImprovement, PriorityLevel} from '../types/resume';
import Icon from './Icon';

interface ApplySuggestionsModalProps {
  visible: boolean;
  improvements: CVImprovement[];
  missingSkills: string[];
  isGenerating: boolean;
  progressMessage: string;
  onClose: () => void;
  onGenerate: (
    selectedImprovements: CVImprovement[],
    selectedMissingSkills: string[],
  ) => void;
}

export const ApplySuggestionsModal: React.FC<ApplySuggestionsModalProps> = ({
  visible,
  improvements,
  missingSkills,
  isGenerating,
  progressMessage,
  onClose,
  onGenerate,
}) => {
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();

  const [selectedTipIds, setSelectedTipIds] = useState<Record<string, boolean>>(
    {},
  );
  const [selectedSkillsMap, setSelectedSkillsMap] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    if (visible) {
      const tipDefaults: Record<string, boolean> = {};
      improvements.forEach(imp => {
        tipDefaults[imp.id] = true;
      });
      setSelectedTipIds(tipDefaults);

      const skillDefaults: Record<string, boolean> = {};
      missingSkills.forEach(skill => {
        skillDefaults[skill] = true;
      });
      setSelectedSkillsMap(skillDefaults);
    }
  }, [visible, improvements, missingSkills]);

  const selectedImprovements = useMemo(
    () => improvements.filter(imp => !!selectedTipIds[imp.id]),
    [improvements, selectedTipIds],
  );

  const selectedSkills = useMemo(
    () => missingSkills.filter(skill => !!selectedSkillsMap[skill]),
    [missingSkills, selectedSkillsMap],
  );

  const allSelected =
    selectedImprovements.length === improvements.length &&
    selectedSkills.length === missingSkills.length;

  const toggleAll = () => {
    const targetState = !allSelected;
    const nextTips: Record<string, boolean> = {};
    improvements.forEach(imp => {
      nextTips[imp.id] = targetState;
    });
    const nextSkills: Record<string, boolean> = {};
    missingSkills.forEach(skill => {
      nextSkills[skill] = targetState;
    });
    setSelectedTipIds(nextTips);
    setSelectedSkillsMap(nextSkills);
  };

  const toggleTip = (id: string) => {
    setSelectedTipIds(prev => ({...prev, [id]: !prev[id]}));
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkillsMap(prev => ({...prev, [skill]: !prev[skill]}));
  };

  const getPriorityBadge = (priority: PriorityLevel) => {
    switch (priority) {
      case 'high':
        return {
          label: 'CRITICAL',
          bg: isDark ? 'rgba(194, 89, 83, 0.2)' : 'rgba(186, 74, 68, 0.12)',
          color: colors.error,
        };
      case 'medium':
        return {
          label: 'RECOMMENDED',
          bg: isDark ? 'rgba(217, 130, 43, 0.2)' : 'rgba(194, 115, 34, 0.12)',
          color: colors.warning,
        };
      default:
        return {
          label: 'POLISH',
          bg: isDark ? 'rgba(91, 130, 102, 0.2)' : 'rgba(74, 124, 89, 0.12)',
          color: colors.success,
        };
    }
  };

  const totalSelected = selectedImprovements.length + selectedSkills.length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        if (!isGenerating) onClose();
      }}
      statusBarTranslucent>
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: isDark
              ? 'rgba(10, 9, 8, 0.96)'
              : 'rgba(250, 249, 246, 0.98)',
            paddingTop: Math.max(insets.top, StatusBar.currentHeight || 0),
          },
        ]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.bgDark,
              borderBottomColor: colors.border,
            },
          ]}>
          <View style={styles.headerLeft}>
            <View
              style={[
                styles.headerIconBox,
                {backgroundColor: colors.accentSoft},
              ]}>
              <Icon name="sparkles" size={16} color={colors.accent} />
            </View>
            <View style={{flex: 1}}>
              <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
                Apply Suggestions to PDF
              </Text>
              <Text
                style={[styles.headerSubtitle, {color: colors.textSecondary}]}>
                Preserves your exact layout, colors & font style
              </Text>
            </View>
          </View>

          <TouchableOpacity
            disabled={isGenerating}
            onPress={onClose}
            style={[
              styles.closeBtn,
              {
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
                opacity: isGenerating ? 0.4 : 1,
              },
            ]}>
            <Icon name="close" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {isGenerating ? (
          <View style={styles.generatingContainer}>
            <View
              style={[
                styles.generatingCard,
                {
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                  ...SHADOWS.elevated,
                },
              ]}>
              <LinearGradient
                colors={[colors.primaryStart, colors.primaryEnd]}
                style={styles.generatingOrb}>
                <Icon name="document-text" size={28} color="#FFFFFF" />
              </LinearGradient>
              <ActivityIndicator
                size="large"
                color={colors.accent}
                style={{marginVertical: SPACING.md}}
              />
              <Text
                style={[styles.generatingTitle, {color: colors.textPrimary}]}>
                Updating Your Resume PDF
              </Text>
              <Text style={[styles.generatingStep, {color: colors.accent}]}>
                {progressMessage || 'Applying AI improvements in-place...'}
              </Text>
              <Text
                style={[
                  styles.generatingHint,
                  {color: colors.textSecondary},
                ]}>
                Matching original fonts, spacing, and visual structure without altering your template.
              </Text>
            </View>
          </View>
        ) : (
          <>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}>
              {/* Info Banner & Select All */}
              <View
                style={[
                  styles.infoBanner,
                  {
                    backgroundColor: isDark
                      ? 'rgba(196, 154, 114, 0.1)'
                      : 'rgba(166, 124, 82, 0.08)',
                    borderColor: isDark
                      ? 'rgba(196, 154, 114, 0.25)'
                      : 'rgba(166, 124, 82, 0.22)',
                  },
                ]}>
                <Icon
                  name="shield-checkmark-outline"
                  size={18}
                  color={colors.accent}
                  style={{marginRight: 10, marginTop: 1}}
                />
                <Text
                  style={[styles.infoBannerText, {color: colors.textPrimary}]}>
                  Selected changes are rewritten directly into your uploaded PDF using matching fonts, sizes, and colors.
                </Text>
              </View>

              <View style={styles.sectionTopRow}>
                <Text
                  style={[styles.sectionHeading, {color: colors.textPrimary}]}>
                  AI Improvement Tips ({selectedImprovements.length}/
                  {improvements.length})
                </Text>
                <TouchableOpacity onPress={toggleAll} activeOpacity={0.7}>
                  <Text style={[styles.selectAllText, {color: colors.accent}]}>
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              </View>

              {improvements.map(imp => {
                const checked = !!selectedTipIds[imp.id];
                const meta = getPriorityBadge(imp.priority);
                return (
                  <TouchableOpacity
                    key={imp.id}
                    activeOpacity={0.8}
                    onPress={() => toggleTip(imp.id)}
                    style={[
                      styles.tipRow,
                      {
                        backgroundColor: colors.bgCard,
                        borderColor: checked ? colors.accent : colors.border,
                      },
                    ]}>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: checked ? colors.accent : colors.border,
                          backgroundColor: checked
                            ? colors.accent
                            : 'transparent',
                        },
                      ]}>
                      {checked && (
                        <Icon name="checkmark" size={14} color="#FFFFFF" />
                      )}
                    </View>

                    <View style={styles.tipContent}>
                      <View style={styles.tipBadges}>
                        <View
                          style={[
                            styles.badge,
                            {backgroundColor: meta.bg},
                          ]}>
                          <Text style={[styles.badgeText, {color: meta.color}]}>
                            {meta.label}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.sectionPill,
                            {
                              backgroundColor: colors.bgCardLight,
                              borderColor: colors.border,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.sectionPillText,
                              {color: colors.textSecondary},
                            ]}>
                            {imp.section}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[styles.tipTitle, {color: colors.textPrimary}]}>
                        {imp.title}
                      </Text>
                      <Text
                        style={[
                          styles.tipDescription,
                          {color: colors.textSecondary},
                        ]}
                        numberOfLines={2}>
                        {imp.example ? imp.example : imp.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {missingSkills.length > 0 && (
                <View style={styles.skillsBlock}>
                  <Text
                    style={[
                      styles.sectionHeading,
                      {color: colors.textPrimary, marginBottom: 4},
                    ]}>
                    Add Recommended ATS Skills ({selectedSkills.length}/
                    {missingSkills.length})
                  </Text>
                  <Text
                    style={[
                      styles.skillsHint,
                      {color: colors.textSecondary},
                    ]}>
                    Keep only skills you genuinely know — they will be woven into your Skills section cleanly.
                  </Text>
                  <View style={styles.skillsWrap}>
                    {missingSkills.map(skill => {
                      const active = !!selectedSkillsMap[skill];
                      return (
                        <TouchableOpacity
                          key={skill}
                          onPress={() => toggleSkill(skill)}
                          activeOpacity={0.75}
                          style={[
                            styles.skillChip,
                            {
                              backgroundColor: active
                                ? colors.accentSoft
                                : colors.bgCard,
                              borderColor: active
                                ? colors.accent
                                : colors.border,
                            },
                          ]}>
                          <Icon
                            name={active ? 'checkmark-circle' : 'add-circle-outline'}
                            size={14}
                            color={active ? colors.accent : colors.textMuted}
                            style={{marginRight: 5}}
                          />
                          <Text
                            style={[
                              styles.skillChipText,
                              {
                                color: active
                                  ? colors.accent
                                  : colors.textSecondary,
                              },
                            ]}>
                            {skill}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View
              style={[
                styles.footer,
                {
                  backgroundColor: colors.bgDark,
                  borderTopColor: colors.border,
                  paddingBottom:
                    Platform.OS === 'android'
                      ? Math.max(insets.bottom, 24) + 12
                      : Math.max(insets.bottom, SPACING.lg),
                },
              ]}>
              <Text
                style={[styles.footerSummary, {color: colors.textSecondary}]}>
                {selectedImprovements.length} tip
                {selectedImprovements.length === 1 ? '' : 's'} &{' '}
                {selectedSkills.length} skill
                {selectedSkills.length === 1 ? '' : 's'} selected • Free for this scan
              </Text>
              <TouchableOpacity
                disabled={totalSelected === 0}
                activeOpacity={0.85}
                onPress={() => onGenerate(selectedImprovements, selectedSkills)}
                style={[
                  styles.generateBtnWrapper,
                  totalSelected === 0 && {opacity: 0.45},
                ]}>
                <LinearGradient
                  colors={[colors.primaryStart, colors.primaryEnd]}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}
                  style={styles.generateBtn}>
                  <Icon
                    name="sparkles"
                    size={ICON_SIZES.md}
                    color="#FFFFFF"
                    style={{marginRight: 8}}
                  />
                  <Text style={styles.generateBtnText}>
                    Generate Updated PDF
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 11.5,
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  infoBannerText: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 12,
    lineHeight: 17,
  },
  sectionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionHeading: {
    fontFamily: FONTS.bold,
    fontSize: 14,
  },
  selectAllText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  tipContent: {
    flex: 1,
  },
  tipBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  badgeText: {
    fontFamily: FONTS.bold,
    fontSize: 9.5,
    letterSpacing: 0.4,
  },
  sectionPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  sectionPillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 9.5,
  },
  tipTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 2,
  },
  tipDescription: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  skillsBlock: {
    marginTop: SPACING.md,
  },
  skillsHint: {
    fontFamily: FONTS.regular,
    fontSize: 11.5,
    marginBottom: SPACING.sm,
    lineHeight: 16,
  },
  skillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  skillChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
  },
  footerSummary: {
    fontFamily: FONTS.medium,
    fontSize: 11.5,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  generateBtnWrapper: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  generateBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  generatingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  generatingCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  generatingOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  generatingTitle: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 6,
  },
  generatingStep: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    lineHeight: 18,
  },
  generatingHint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
});

export default ApplySuggestionsModal;
