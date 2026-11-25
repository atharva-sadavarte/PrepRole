/* eslint-disable react-native/no-inline-styles */
import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Share,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Session} from '@supabase/supabase-js';
import {useTheme} from '../context/ThemeContext';
import {RADIUS, SPACING, ICON_SIZES, FONTS} from '../lib/theme';
import {ScoreGauge} from '../components/ScoreGauge';
import {RecommendationCard} from '../components/RecommendationCard';
import {
  cacheOriginalLocalPdfUri,
  ensureLocalPdfUri,
  getCachedUpdatedPdfInfo,
  isPdfAnalysis,
  openResumeInViewer,
  saveAnalysis,
  uploadResumeFile,
} from '../services/resumeService';
import {
  getPdfBase64,
  isNativePdfEditingSupported,
  openSystemPdfViewer,
  savePdfToDownloads,
  sharePdfFile,
} from '../services/pdfService';
import {generateUpdatedResumePdf} from '../services/pdfEditService';
import {analyzeCVWithAI} from '../services/aiService';
import {
  CVImprovement,
  GeneratedUpdatedPdfInfo,
  PriorityLevel,
  ResumeAnalysisRecord,
} from '../types/resume';
import {useQuota} from '../context/QuotaContext';
import PaywallModal from '../components/PaywallModal';
import ApplySuggestionsModal from '../components/ApplySuggestionsModal';
import PdfPreviewModal from '../components/PdfPreviewModal';
import Icon from '../components/Icon';

interface CVScoreResultScreenProps {
  session?: Session;
  route: {
    params: {
      analysis: ResumeAnalysisRecord;
      localPdfUri?: string;
      previousScore?: number;
    };
  };
  navigation: any;
}

export const CVScoreResultScreen: React.FC<CVScoreResultScreenProps> = ({
  session,
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();
  const {
    isPro,
    creditsRemaining,
    refreshQuota,
    showPaywall,
    paywallReason,
    openPaywall,
    closePaywall,
  } = useQuota();
  const {analysis, localPdfUri, previousScore} = route.params;
  const effectiveUserId = session?.user?.id || analysis.user_id;

  const [activeTab, setActiveTab] = useState<
    'recommendations' | 'skills' | 'strengths'
  >('recommendations');
  const [priorityFilter, setPriorityFilter] = useState<'all' | PriorityLevel>(
    'all',
  );
  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>({});

  // PDF Editing & Preview state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [generateProgress, setGenerateProgress] = useState('');
  const [updatedPdfInfo, setUpdatedPdfInfo] =
    useState<GeneratedUpdatedPdfInfo | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewOrigUri, setPreviewOrigUri] = useState<string | null>(
    localPdfUri || null,
  );
  const [previewUpdatedUri, setPreviewUpdatedUri] = useState<string | null>(
    null,
  );
  const [isPreparingFile, setIsPreparingFile] = useState(false);
  const [isRescoring, setIsRescoring] = useState(false);

  const canEditPdf = isPdfAnalysis(analysis);

  useEffect(() => {
    let mounted = true;
    const hydrateUpdatedPdf = async () => {
      const cached = await getCachedUpdatedPdfInfo(analysis.id);
      if (!mounted) return;
      if (cached) {
        setUpdatedPdfInfo(cached);
        setPreviewUpdatedUri(cached.localUri);
      } else if (analysis.updated_file_url) {
        setUpdatedPdfInfo({
          localUri: '',
          fileName:
            analysis.updated_file_name ||
            `${(analysis.file_name || 'Resume').replace(/\.pdf$/i, '')}_Updated.pdf`,
          storagePath: analysis.updated_file_url,
          appliedCount: analysis.updated_summary_of_changes?.length || 1,
          changesSummary: analysis.updated_summary_of_changes || [],
          fontMatchDetails: [],
          generatedAt: analysis.updated_at || analysis.created_at,
        });
      }
    };
    hydrateUpdatedPdf();
    return () => {
      mounted = false;
    };
  }, [analysis]);

  const toggleComplete = (id: string) => {
    setCompletedMap(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleShareScore = async () => {
    try {
      await Share.share({
        message: `My resume scored ${analysis.overall_score}/100 for the role of "${analysis.target_role}" on PrepRole! Benchmark your CV against ATS standards.`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenApplyModal = () => {
    if (!canEditPdf) {
      Alert.alert(
        'PDF Upload Required',
        'Upload a .pdf resume file to generate an edited PDF in your exact original style and font.',
      );
      return;
    }
    if (!isNativePdfEditingSupported()) {
      Alert.alert(
        'Supported on Android',
        'In-place PDF style & font editing is currently supported on Android devices.',
      );
      return;
    }
    setShowApplyModal(true);
  };

  const handleGenerateUpdatedPdf = async (
    selectedImprovements: CVImprovement[],
    selectedMissingSkills: string[],
  ) => {
    setIsGeneratingPdf(true);
    setGenerateProgress('Starting PDF editor...');
    try {
      const info = await generateUpdatedResumePdf({
        userId: effectiveUserId,
        analysis,
        selectedImprovements,
        selectedMissingSkills,
        preferredOriginalLocalUri: localPdfUri,
        onProgress: msg => setGenerateProgress(msg),
      });

      setUpdatedPdfInfo(info);
      setPreviewUpdatedUri(info.localUri);
      if (localPdfUri) {
        setPreviewOrigUri(localPdfUri);
      }
      setShowApplyModal(false);

      // Automatically open side-by-side preview modal after generating
      try {
        const origLocal = await ensureLocalPdfUri(
          analysis.id,
          analysis.file_url,
          localPdfUri,
          'orig',
          analysis.file_name,
        );
        setPreviewOrigUri(origLocal);
      } catch {
        // Preview still opens cleanly even if comparison original isn't fetched
      }
      setShowPreviewModal(true);
    } catch (err: any) {
      console.error('Updated PDF generation error:', err);
      Alert.alert(
        'Could Not Update PDF',
        err?.message ||
          'An unexpected error occurred while updating your PDF. Please try again.',
      );
    } finally {
      setIsGeneratingPdf(false);
      setGenerateProgress('');
    }
  };

  const resolveUpdatedLocalUri = async (): Promise<string> => {
    if (!updatedPdfInfo) {
      throw new Error('No updated PDF has been generated yet.');
    }
    const localUri = await ensureLocalPdfUri(
      analysis.id,
      updatedPdfInfo.storagePath || analysis.updated_file_url,
      updatedPdfInfo.localUri,
      'updated',
      updatedPdfInfo.fileName,
    );
    if (localUri !== updatedPdfInfo.localUri) {
      setUpdatedPdfInfo(prev => (prev ? {...prev, localUri} : prev));
    }
    setPreviewUpdatedUri(localUri);
    return localUri;
  };

  const handlePreviewUpdatedPdf = async () => {
    setIsPreparingFile(true);
    try {
      const updatedUri = await resolveUpdatedLocalUri();
      setPreviewUpdatedUri(updatedUri);
      try {
        const origUri = await ensureLocalPdfUri(
          analysis.id,
          analysis.file_url,
          localPdfUri || previewOrigUri,
          'orig',
          analysis.file_name,
        );
        setPreviewOrigUri(origUri);
      } catch {
        // Optional comparison uri
      }
      setShowPreviewModal(true);
    } catch (err: any) {
      Alert.alert(
        'Preview Unavailable',
        err?.message || 'Could not load the updated PDF for preview.',
      );
    } finally {
      setIsPreparingFile(false);
    }
  };

  const handleDownloadUpdatedPdf = async (overrideUri?: string) => {
    setIsPreparingFile(true);
    try {
      const targetUri = overrideUri || (await resolveUpdatedLocalUri());
      const fileName = updatedPdfInfo?.fileName || 'Updated_Resume.pdf';
      const saved = await savePdfToDownloads(targetUri, fileName);
      Alert.alert(
        'Saved to Downloads',
        `Your updated resume PDF was saved to:\n${saved.location}`,
        [
          {
            text: 'Open PDF',
            onPress: () => openSystemPdfViewer(saved.uri),
          },
          {text: 'Done', style: 'default'},
        ],
      );
    } catch (err: any) {
      Alert.alert(
        'Save Failed',
        err?.message || 'Could not save the PDF to Downloads.',
      );
    } finally {
      setIsPreparingFile(false);
    }
  };

  const handleShareUpdatedPdf = async (overrideUri?: string) => {
    setIsPreparingFile(true);
    try {
      const targetUri = overrideUri || (await resolveUpdatedLocalUri());
      const shared = await sharePdfFile(
        targetUri,
        updatedPdfInfo?.fileName || 'Updated Resume PDF',
      );
      if (!shared) {
        Alert.alert(
          'Share Unavailable',
          'Sharing local PDF files is currently supported on Android devices.',
        );
      }
    } catch (err: any) {
      Alert.alert('Share Failed', err?.message || 'Could not share PDF.');
    } finally {
      setIsPreparingFile(false);
    }
  };

  const handleRescoreUpdatedPdf = async () => {
    if (!isPro && creditsRemaining <= 0) {
      Alert.alert(
        'No Scans Remaining',
        'Re-scoring your updated PDF uses 1 scan credit. Upgrade to PrepRole Pro for unlimited scans.',
        [
          {text: 'Upgrade to Pro', onPress: () => openPaywall('out_of_credits')},
          {text: 'Cancel', style: 'cancel'},
        ],
      );
      return;
    }

    setIsRescoring(true);
    try {
      const updatedUri = await resolveUpdatedLocalUri();
      const pdfBase64 = await getPdfBase64(updatedUri);
      const updatedName =
        updatedPdfInfo?.fileName ||
        `${(analysis.file_name || 'Resume').replace(/\.pdf$/i, '')}_Updated.pdf`;

      const newResult = await analyzeCVWithAI({
        pdfBase64,
        targetRole: analysis.target_role,
        jobDescription: analysis.job_description,
      });

      await refreshQuota();

      let uploadedPath = updatedPdfInfo?.storagePath || undefined;
      if (!uploadedPath) {
        const uploaded = await uploadResumeFile(
          effectiveUserId,
          updatedUri,
          updatedName,
          'application/pdf',
        );
        if (uploaded?.path) {
          uploadedPath = uploaded.path;
        }
      }

      const savedRecord = await saveAnalysis(
        effectiveUserId,
        newResult,
        updatedName,
        uploadedPath,
      );

      const cachedLocal = await cacheOriginalLocalPdfUri(
        savedRecord.id,
        updatedUri,
        updatedName,
      );

      navigation.replace('CVScoreResult', {
        analysis: savedRecord,
        localPdfUri: cachedLocal || updatedUri,
        previousScore: analysis.overall_score,
      });
    } catch (err: any) {
      if (
        err?.code === 'QUOTA_EXCEEDED' ||
        err?.message?.includes('free CV scans') ||
        err?.message?.includes('QUOTA_EXCEEDED')
      ) {
        openPaywall('out_of_credits');
        return;
      }
      Alert.alert(
        'Re-Score Failed',
        err?.message || 'Could not re-analyze your updated PDF.',
      );
    } finally {
      setIsRescoring(false);
    }
  };

  const improvements = analysis.improvements || [];
  const filteredImprovements =
    priorityFilter === 'all'
      ? improvements
      : improvements.filter(imp => imp.priority === priorityFilter);

  const completedCount = Object.values(completedMap).filter(Boolean).length;
  const totalCount = improvements.length;

  const getPriorityIcon = (p: string) => {
    switch (p) {
      case 'high':
        return {color: '#C25953', label: 'Critical Fixes'};
      case 'medium':
        return {color: '#D9822B', label: 'Recommended'};
      case 'low':
        return {color: '#5B8266', label: 'Polish'};
      default:
        return {color: colors.textSecondary, label: 'All'};
    }
  };

  const scoreDelta =
    typeof previousScore === 'number'
      ? analysis.overall_score - previousScore
      : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={[colors.bgDark, colors.gradientMiddle, colors.gradientEnd]}
        style={styles.gradient}>
        {/* Header with Safe Area Insets */}
        <View
          style={[
            styles.header,
            {
              paddingTop:
                Math.max(insets.top, StatusBar.currentHeight || 0) + SPACING.xs,
              backgroundColor: colors.bgDark,
              borderBottomColor: colors.border,
            },
          ]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[
              styles.headerBtn,
              {
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
              },
            ]}
            activeOpacity={0.7}
            accessibilityLabel="Go back">
            <Icon name="chevron-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
            CV Analysis Report
          </Text>

          <TouchableOpacity
            onPress={handleShareScore}
            style={[
              styles.headerBtn,
              {
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
              },
            ]}
            activeOpacity={0.7}
            accessibilityLabel="Share score report">
            <Icon name="share-outline" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: Math.max(insets.bottom, 48) + SPACING.xxl,
            },
          ]}>
          {/* Target Role Banner */}
          <View
            style={[
              styles.roleBanner,
              {
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
                shadowColor: colors.cardShadow,
                elevation: isDark ? 2 : 4,
              },
            ]}>
            <View style={styles.roleBannerTopRow}>
              <View
                style={[
                  styles.roleBadgePill,
                  {
                    backgroundColor: isDark
                      ? 'rgba(196, 154, 114, 0.15)'
                      : 'rgba(166, 124, 82, 0.12)',
                    borderColor: isDark
                      ? 'rgba(196, 154, 114, 0.3)'
                      : 'rgba(166, 124, 82, 0.25)',
                  },
                ]}>
                <Icon
                  name="briefcase-outline"
                  size={11}
                  color={colors.accent}
                />
                <Text style={[styles.roleLabel, {color: colors.accent}]}>
                  TARGET ROLE ANALYSIS
                </Text>
              </View>
            </View>

            <Text style={[styles.roleTitle, {color: colors.textPrimary}]}>
              {analysis.target_role}
            </Text>

            {analysis.file_name && (
              <View style={styles.sourceContainer}>
                <View
                  style={[
                    styles.fileIconPill,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(36, 35, 33, 0.05)',
                    },
                  ]}>
                  <Icon
                    name="document-text-outline"
                    size={13}
                    color={colors.accent}
                  />
                </View>
                <Text
                  style={[styles.fileSub, {color: colors.textSecondary}]}
                  numberOfLines={1}
                  ellipsizeMode="middle">
                  {analysis.file_name}
                </Text>
                {analysis.file_url ? (
                  <TouchableOpacity
                    onPress={() => openResumeInViewer(analysis.file_url!)}
                    style={[
                      styles.previewBadgeBtn,
                      {
                        backgroundColor: isDark
                          ? 'rgba(196, 154, 114, 0.15)'
                          : 'rgba(166, 124, 82, 0.12)',
                        borderColor: isDark
                          ? 'rgba(196, 154, 114, 0.35)'
                          : 'rgba(166, 124, 82, 0.3)',
                      },
                    ]}
                    activeOpacity={0.7}>
                    <Icon
                      name="eye-outline"
                      size={13}
                      color={colors.accent}
                      style={{marginRight: 4}}
                    />
                    <Text
                      style={[
                        styles.previewBadgeText,
                        {color: colors.accent},
                      ]}>
                      View PDF
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>

          {/* Score Improvement Delta Pill (after Re-Scoring Updated PDF) */}
          {scoreDelta !== null && (
            <View
              style={[
                styles.deltaBanner,
                {
                  backgroundColor:
                    scoreDelta >= 0
                      ? isDark
                        ? 'rgba(91, 130, 102, 0.16)'
                        : 'rgba(74, 124, 89, 0.12)'
                      : colors.bgCard,
                  borderColor:
                    scoreDelta >= 0 ? colors.success : colors.border,
                },
              ]}>
              <Icon
                name={scoreDelta >= 0 ? 'trending-up' : 'analytics-outline'}
                size={16}
                color={scoreDelta >= 0 ? colors.success : colors.accent}
                style={{marginRight: 8}}
              />
              <Text
                style={[
                  styles.deltaText,
                  {color: scoreDelta >= 0 ? colors.success : colors.textPrimary},
                ]}>
                {scoreDelta > 0
                  ? `Updated PDF Score: ${previousScore} → ${analysis.overall_score} (+${scoreDelta} pts!)`
                  : scoreDelta === 0
                  ? `Updated PDF Score: ${analysis.overall_score}/100 (unchanged)`
                  : `Updated PDF Score: ${previousScore} → ${analysis.overall_score} (${scoreDelta} pts)`}
              </Text>
            </View>
          )}

          {/* Score Hero Card */}
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
                shadowColor: colors.cardShadow,
                elevation: isDark ? 2 : 4,
              },
            ]}>
            <ScoreGauge
              score={analysis.overall_score}
              tier={analysis.score_tier}
            />

            {/* AI Executive Summary Box */}
            <View
              style={[
                styles.summaryBox,
                {
                  backgroundColor: isDark
                    ? 'rgba(196, 154, 114, 0.07)'
                    : 'rgba(166, 124, 82, 0.06)',
                  borderColor: isDark
                    ? 'rgba(196, 154, 114, 0.22)'
                    : 'rgba(166, 124, 82, 0.2)',
                  borderLeftColor: colors.accent,
                },
              ]}>
              <View style={styles.summaryHeader}>
                <View
                  style={[
                    styles.summaryIconBadge,
                    {
                      backgroundColor: isDark
                        ? 'rgba(196, 154, 114, 0.2)'
                        : 'rgba(166, 124, 82, 0.15)',
                    },
                  ]}>
                  <Icon name="sparkles" size={12} color={colors.accent} />
                </View>
                <Text style={[styles.summaryTitle, {color: colors.accent}]}>
                  AI Executive Summary
                </Text>
              </View>
              <Text style={[styles.summaryText, {color: colors.textPrimary}]}>
                {analysis.summary}
              </Text>
            </View>

            {/* 4 Score Breakdown Pillars */}
            <View style={styles.breakdownGrid}>
              <View
                style={[
                  styles.breakdownItem,
                  {
                    backgroundColor: isDark
                      ? colors.bgCardLight
                      : 'rgba(36, 35, 33, 0.04)',
                    borderColor: colors.border,
                  },
                ]}>
                <Icon
                  name="compass-outline"
                  size={ICON_SIZES.md}
                  color={colors.accent}
                />
                <Text
                  style={[styles.breakdownScore, {color: colors.textPrimary}]}>
                  {analysis.breakdown?.relevance || 0}%
                </Text>
                <Text
                  style={[styles.breakdownLabel, {color: colors.textSecondary}]}
                  numberOfLines={1}>
                  Role
                </Text>
              </View>

              <View
                style={[
                  styles.breakdownItem,
                  {
                    backgroundColor: isDark
                      ? colors.bgCardLight
                      : 'rgba(36, 35, 33, 0.04)',
                    borderColor: colors.border,
                  },
                ]}>
                <Icon
                  name="hardware-chip-outline"
                  size={ICON_SIZES.md}
                  color={colors.primaryStart}
                />
                <Text
                  style={[styles.breakdownScore, {color: colors.textPrimary}]}>
                  {analysis.breakdown?.skills || 0}%
                </Text>
                <Text
                  style={[styles.breakdownLabel, {color: colors.textSecondary}]}
                  numberOfLines={1}>
                  Skills
                </Text>
              </View>

              <View
                style={[
                  styles.breakdownItem,
                  {
                    backgroundColor: isDark
                      ? colors.bgCardLight
                      : 'rgba(36, 35, 33, 0.04)',
                    borderColor: colors.border,
                  },
                ]}>
                <Icon
                  name="trending-up-outline"
                  size={ICON_SIZES.md}
                  color={colors.success}
                />
                <Text
                  style={[styles.breakdownScore, {color: colors.textPrimary}]}>
                  {analysis.breakdown?.impact || 0}%
                </Text>
                <Text
                  style={[styles.breakdownLabel, {color: colors.textSecondary}]}
                  numberOfLines={1}>
                  Impact
                </Text>
              </View>

              <View
                style={[
                  styles.breakdownItem,
                  {
                    backgroundColor: isDark
                      ? colors.bgCardLight
                      : 'rgba(36, 35, 33, 0.04)',
                    borderColor: colors.border,
                  },
                ]}>
                <Icon
                  name="document-text-outline"
                  size={ICON_SIZES.md}
                  color={colors.warning}
                />
                <Text
                  style={[styles.breakdownScore, {color: colors.textPrimary}]}>
                  {analysis.breakdown?.ats || 0}%
                </Text>
                <Text
                  style={[styles.breakdownLabel, {color: colors.textSecondary}]}
                  numberOfLines={1}>
                  ATS
                </Text>
              </View>
            </View>
          </View>

          {/* AI Resume PDF Auto-Updater Card */}
          <View
            style={[
              styles.pdfUpdaterCard,
              {
                backgroundColor: colors.bgCard,
                borderColor: updatedPdfInfo ? colors.success : colors.accent,
                shadowColor: colors.cardShadow,
                elevation: isDark ? 2 : 4,
              },
            ]}>
            {!canEditPdf ? (
              <View style={styles.pdfNoticeRow}>
                <View
                  style={[
                    styles.pdfIconCircle,
                    {backgroundColor: colors.bgCardLight},
                  ]}>
                  <Icon
                    name="document-attach-outline"
                    size={20}
                    color={colors.textMuted}
                  />
                </View>
                <View style={{flex: 1}}>
                  <Text
                    style={[
                      styles.pdfUpdaterTitle,
                      {color: colors.textPrimary},
                    ]}>
                    PDF Auto-Editor Available for PDFs
                  </Text>
                  <Text
                    style={[
                      styles.pdfUpdaterDesc,
                      {color: colors.textSecondary},
                    ]}>
                    Upload a .pdf file on the Analyze tab to receive an updated PDF preserving your exact style and font formatting.
                  </Text>
                </View>
              </View>
            ) : updatedPdfInfo ? (
              <View>
                <View style={styles.pdfCardHeader}>
                  <View
                    style={[
                      styles.pdfIconCircle,
                      {
                        backgroundColor: isDark
                          ? 'rgba(91, 130, 102, 0.2)'
                          : 'rgba(74, 124, 89, 0.14)',
                      },
                    ]}>
                    <Icon
                      name="checkmark-done"
                      size={20}
                      color={colors.success}
                    />
                  </View>
                  <View style={{flex: 1}}>
                    <View style={styles.pdfBadgeRow}>
                      <Text
                        style={[
                          styles.pdfUpdaterTitle,
                          {color: colors.textPrimary},
                        ]}>
                        Updated PDF Ready
                      </Text>
                      <View
                        style={[
                          styles.pdfReadyPill,
                          {
                            backgroundColor: isDark
                              ? 'rgba(91, 130, 102, 0.2)'
                              : 'rgba(74, 124, 89, 0.12)',
                          },
                        ]}>
                        <Text
                          style={[
                            styles.pdfReadyPillText,
                            {color: colors.success},
                          ]}>
                          STYLE PRESERVED
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.pdfUpdaterSub,
                        {color: colors.textSecondary},
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="middle">
                      {updatedPdfInfo.fileName} • {updatedPdfInfo.appliedCount}{' '}
                      inline edits
                    </Text>
                  </View>
                </View>

                {updatedPdfInfo.changesSummary.length > 0 && (
                  <View
                    style={[
                      styles.changesBox,
                      {
                        backgroundColor: colors.bgInput,
                        borderColor: colors.border,
                      },
                    ]}>
                    {updatedPdfInfo.changesSummary
                      .slice(0, 3)
                      .map((ch, idx) => (
                        <View key={idx} style={styles.changeRow}>
                          <Icon
                            name="checkmark-circle"
                            size={13}
                            color={colors.success}
                            style={{marginRight: 6, marginTop: 2}}
                          />
                          <Text
                            style={[
                              styles.changeText,
                              {color: colors.textSecondary},
                            ]}>
                            {ch}
                          </Text>
                        </View>
                      ))}
                  </View>
                )}

                {/* Action Row: Preview, Save, Share */}
                <View style={styles.pdfActionsRow}>
                  <TouchableOpacity
                    disabled={isPreparingFile || isRescoring}
                    onPress={handlePreviewUpdatedPdf}
                    activeOpacity={0.8}
                    style={[
                      styles.pdfActionBtn,
                      {
                        backgroundColor: colors.accentSoft,
                        borderColor: colors.accent,
                      },
                    ]}>
                    <Icon
                      name="eye-outline"
                      size={16}
                      color={colors.accent}
                    />
                    <Text
                      style={[styles.pdfActionBtnText, {color: colors.accent}]}>
                      Preview
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={isPreparingFile || isRescoring}
                    onPress={() => handleDownloadUpdatedPdf()}
                    activeOpacity={0.8}
                    style={[
                      styles.pdfActionBtn,
                      {
                        backgroundColor: colors.bgCardLight,
                        borderColor: colors.border,
                      },
                    ]}>
                    <Icon
                      name="download-outline"
                      size={16}
                      color={colors.textPrimary}
                    />
                    <Text
                      style={[
                        styles.pdfActionBtnText,
                        {color: colors.textPrimary},
                      ]}>
                      Save
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={isPreparingFile || isRescoring}
                    onPress={() => handleShareUpdatedPdf()}
                    activeOpacity={0.8}
                    style={[
                      styles.pdfActionBtn,
                      {
                        backgroundColor: colors.bgCardLight,
                        borderColor: colors.border,
                      },
                    ]}>
                    <Icon
                      name="share-social-outline"
                      size={16}
                      color={colors.textPrimary}
                    />
                    <Text
                      style={[
                        styles.pdfActionBtnText,
                        {color: colors.textPrimary},
                      ]}>
                      Share
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Re-Score Updated PDF CTA */}
                <TouchableOpacity
                  disabled={isRescoring || isPreparingFile}
                  onPress={handleRescoreUpdatedPdf}
                  activeOpacity={0.85}
                  style={styles.rescoreWrapper}>
                  <LinearGradient
                    colors={[colors.primaryStart, colors.primaryEnd]}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 1}}
                    style={styles.rescoreBtn}>
                    {isRescoring ? (
                      <ActivityIndicator
                        size="small"
                        color="#FFFFFF"
                        style={{marginRight: 8}}
                      />
                    ) : (
                      <Icon
                        name="analytics"
                        size={17}
                        color="#FFFFFF"
                        style={{marginRight: 8}}
                      />
                    )}
                    <Text style={styles.rescoreBtnText}>
                      {isRescoring
                        ? 'Re-Scoring Updated PDF...'
                        : 'Re-Score Updated PDF'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={isRescoring || isPreparingFile}
                  onPress={handleOpenApplyModal}
                  style={styles.customizeLinkBtn}
                  activeOpacity={0.7}>
                  <Text
                    style={[styles.customizeLinkText, {color: colors.accent}]}>
                    Customize Selected Suggestions & Regenerate
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={styles.pdfCardHeader}>
                  <View
                    style={[
                      styles.pdfIconCircle,
                      {backgroundColor: colors.accentSoft},
                    ]}>
                    <Icon name="sparkles" size={20} color={colors.accent} />
                  </View>
                  <View style={{flex: 1}}>
                    <Text
                      style={[
                        styles.pdfUpdaterTitle,
                        {color: colors.textPrimary},
                      ]}>
                      Apply AI Suggestions to Your PDF
                    </Text>
                    <Text
                      style={[
                        styles.pdfUpdaterDesc,
                        {color: colors.textSecondary},
                      ]}>
                      Generate an updated PDF with selected rewrites & missing skills while keeping your exact layout, colors, and font style.
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleOpenApplyModal}
                  activeOpacity={0.85}
                  style={styles.applyPrimaryWrapper}>
                  <LinearGradient
                    colors={[colors.primaryStart, colors.primaryEnd]}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 1}}
                    style={styles.applyPrimaryBtn}>
                    <Icon
                      name="color-wand-outline"
                      size={18}
                      color="#FFFFFF"
                      style={{marginRight: 8}}
                    />
                    <Text style={styles.applyPrimaryBtnText}>
                      Select Suggestions & Update PDF
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Navigation Tabs */}
          <View
            style={[
              styles.tabsContainer,
              {
                backgroundColor: isDark
                  ? colors.bgCardLight
                  : 'rgba(36, 35, 33, 0.05)',
                borderColor: colors.border,
              },
            ]}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'recommendations' && [
                  styles.tabButtonActive,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                  },
                ],
              ]}
              onPress={() => setActiveTab('recommendations')}>
              <Icon
                name={
                  activeTab === 'recommendations' ? 'bulb' : 'bulb-outline'
                }
                size={ICON_SIZES.sm}
                color={
                  activeTab === 'recommendations'
                    ? colors.accent
                    : colors.textSecondary
                }
                style={{marginRight: 4}}
              />
              <Text
                style={[
                  styles.tabText,
                  {color: colors.textSecondary},
                  activeTab === 'recommendations' && {
                    color: colors.accent,
                    fontFamily: FONTS.bold,
                  },
                ]}>
                Tips ({improvements.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'skills' && [
                  styles.tabButtonActive,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                  },
                ],
              ]}
              onPress={() => setActiveTab('skills')}>
              <Icon
                name={activeTab === 'skills' ? 'flash' : 'flash-outline'}
                size={ICON_SIZES.sm}
                color={
                  activeTab === 'skills'
                    ? colors.accent
                    : colors.textSecondary
                }
                style={{marginRight: 4}}
              />
              <Text
                style={[
                  styles.tabText,
                  {color: colors.textSecondary},
                  activeTab === 'skills' && {
                    color: colors.accent,
                    fontFamily: FONTS.bold,
                  },
                ]}>
                Skills
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'strengths' && [
                  styles.tabButtonActive,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                  },
                ],
              ]}
              onPress={() => setActiveTab('strengths')}>
              <Icon
                name={activeTab === 'strengths' ? 'star' : 'star-outline'}
                size={ICON_SIZES.sm}
                color={
                  activeTab === 'strengths'
                    ? colors.accent
                    : colors.textSecondary
                }
                style={{marginRight: 4}}
              />
              <Text
                style={[
                  styles.tabText,
                  {color: colors.textSecondary},
                  activeTab === 'strengths' && {
                    color: colors.accent,
                    fontFamily: FONTS.bold,
                  },
                ]}>
                Strengths
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: RECOMMENDATIONS */}
          {activeTab === 'recommendations' && (
            <View style={styles.sectionContainer}>
              {/* Progress counter */}
              <View style={styles.progressRow}>
                <View style={styles.progressLabelRow}>
                  <Text
                    style={[styles.progressText, {color: colors.textPrimary}]}>
                    Action Plan
                  </Text>
                  <Text style={[styles.progressCount, {color: colors.accent}]}>
                    {completedCount} of {totalCount} completed
                  </Text>
                </View>
                <View
                  style={[
                    styles.progressBarBg,
                    {
                      backgroundColor: isDark
                        ? colors.bgCardLight
                        : 'rgba(36, 35, 33, 0.08)',
                    },
                  ]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        backgroundColor: colors.success,
                        width:
                          totalCount > 0
                            ? `${(completedCount / totalCount) * 100}%`
                            : '0%',
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Priority Filters */}
              <View style={styles.filtersRow}>
                {(['all', 'high', 'medium', 'low'] as const).map(p => {
                  const meta = getPriorityIcon(p);
                  const isSelected = priorityFilter === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: isSelected
                            ? colors.accent
                            : colors.bgCard,
                          borderColor: isSelected
                            ? colors.accent
                            : colors.border,
                        },
                      ]}
                      onPress={() => setPriorityFilter(p)}
                      activeOpacity={0.7}>
                      {p !== 'all' && (
                        <View
                          style={[
                            styles.filterDot,
                            {
                              backgroundColor: isSelected
                                ? '#FFFFFF'
                                : meta.color,
                            },
                          ]}
                        />
                      )}
                      <Text
                        style={[
                          styles.filterChipText,
                          {
                            color: isSelected
                              ? '#FFFFFF'
                              : colors.textSecondary,
                            fontFamily: isSelected
                              ? FONTS.bold
                              : FONTS.semiBold,
                          },
                        ]}>
                        {meta.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {filteredImprovements.map(imp => (
                <RecommendationCard
                  key={imp.id}
                  item={{
                    ...imp,
                    completed: !!completedMap[imp.id],
                  }}
                  onToggleComplete={toggleComplete}
                />
              ))}
            </View>
          )}

          {/* TAB 2: SKILLS MATRIX */}
          {activeTab === 'skills' && (
            <View style={styles.sectionContainer}>
              {/* Matched Skills */}
              <View
                style={[
                  styles.skillsCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    shadowColor: colors.cardShadow,
                    elevation: isDark ? 2 : 4,
                  },
                ]}>
                <View style={styles.skillsHeader}>
                  <Icon
                    name="checkmark-circle"
                    size={ICON_SIZES.md}
                    color={colors.success}
                  />
                  <Text style={[styles.skillsTitle, {color: colors.success}]}>
                    Matched Skills ({analysis.skills_matched?.length || 0})
                  </Text>
                </View>
                <Text
                  style={[
                    styles.skillsSubtitle,
                    {color: colors.textSecondary},
                  ]}>
                  Identified in your CV matching requirements for this role:
                </Text>
                <View style={styles.skillsChips}>
                  {analysis.skills_matched?.length ? (
                    analysis.skills_matched.map((skill, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.skillMatchedBadge,
                          {
                            backgroundColor: isDark
                              ? 'rgba(91, 130, 102, 0.18)'
                              : 'rgba(74, 124, 89, 0.12)',
                            borderColor: isDark
                              ? 'rgba(91, 130, 102, 0.4)'
                              : 'rgba(74, 124, 89, 0.3)',
                          },
                        ]}>
                        <Icon
                          name="checkmark"
                          size={ICON_SIZES.xs}
                          color={colors.success}
                          style={{marginRight: 4}}
                        />
                        <Text
                          style={[
                            styles.skillMatchedText,
                            {color: colors.success},
                          ]}>
                          {skill}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text
                      style={[styles.emptyText, {color: colors.textMuted}]}>
                      No matched skills detected.
                    </Text>
                  )}
                </View>
              </View>

              {/* Missing / Recommended Skills */}
              <View
                style={[
                  styles.skillsCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    shadowColor: colors.cardShadow,
                    elevation: isDark ? 2 : 4,
                  },
                ]}>
                <View style={styles.skillsHeader}>
                  <Icon
                    name="alert-circle"
                    size={ICON_SIZES.md}
                    color={colors.warning}
                  />
                  <Text style={[styles.skillsTitle, {color: colors.warning}]}>
                    Recommended Skills to Add (
                    {analysis.skills_missing?.length || 0})
                  </Text>
                </View>
                <Text
                  style={[
                    styles.skillsSubtitle,
                    {color: colors.textSecondary},
                  ]}>
                  Frequently requested for {analysis.target_role} but missing
                  from your CV:
                </Text>
                <View style={styles.skillsChips}>
                  {analysis.skills_missing?.length ? (
                    analysis.skills_missing.map((skill, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.skillMissingBadge,
                          {
                            backgroundColor: isDark
                              ? 'rgba(217, 130, 43, 0.18)'
                              : 'rgba(194, 115, 34, 0.12)',
                            borderColor: isDark
                              ? 'rgba(217, 130, 43, 0.4)'
                              : 'rgba(194, 115, 34, 0.3)',
                          },
                        ]}>
                        <Icon
                          name="add"
                          size={ICON_SIZES.xs}
                          color={colors.warning}
                          style={{marginRight: 4}}
                        />
                        <Text
                          style={[
                            styles.skillMissingText,
                            {color: colors.warning},
                          ]}>
                          {skill}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text
                      style={[styles.emptyText, {color: colors.textMuted}]}>
                      No missing skills detected. Great job!
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* TAB 3: STRENGTHS */}
          {activeTab === 'strengths' && (
            <View style={styles.sectionContainer}>
              <View
                style={[
                  styles.strengthsCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    shadowColor: colors.cardShadow,
                    elevation: isDark ? 2 : 4,
                  },
                ]}>
                <View style={styles.strengthsHeader}>
                  <View
                    style={[
                      styles.strengthsIconBadge,
                      {backgroundColor: colors.accentSoft},
                    ]}>
                    <Icon name="star" size={14} color={colors.accent} />
                  </View>
                  <Text
                    style={[
                      styles.strengthsTitle,
                      {color: colors.textPrimary},
                    ]}>
                    What Stood Out in Your CV
                  </Text>
                </View>
                <Text
                  style={[
                    styles.strengthsSubtitle,
                    {color: colors.textSecondary},
                  ]}>
                  Keep these strong elements intact when updating your resume:
                </Text>
                {analysis.strengths?.map((str, idx) => (
                  <View key={idx} style={styles.strengthItem}>
                    <View
                      style={[
                        styles.strengthBulletPill,
                        {backgroundColor: colors.accentSoft},
                      ]}>
                      <Icon name="star" size={11} color={colors.accent} />
                    </View>
                    <Text
                      style={[
                        styles.strengthText,
                        {color: colors.textPrimary},
                      ]}>
                      {str}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>
            {analysis.file_url ? (
              <TouchableOpacity
                onPress={() => openResumeInViewer(analysis.file_url!)}
                style={[
                  styles.viewDocBtn,
                  {
                    backgroundColor: isDark
                      ? 'rgba(196, 154, 114, 0.12)'
                      : 'rgba(166, 124, 82, 0.08)',
                    borderColor: colors.accent,
                  },
                ]}
                activeOpacity={0.8}>
                <Icon
                  name="eye-outline"
                  size={ICON_SIZES.md}
                  color={colors.accent}
                  style={{marginRight: 8}}
                />
                <Text style={[styles.viewDocBtnText, {color: colors.accent}]}>
                  View Uploaded Resume (PDF)
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[
                styles.rescanButton,
                {
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                },
              ]}
              activeOpacity={0.8}>
              <Icon
                name="refresh"
                size={ICON_SIZES.md}
                color={colors.textPrimary}
                style={{marginRight: 8}}
              />
              <Text
                style={[styles.rescanButtonText, {color: colors.textPrimary}]}>
                Re-Analyze Another CV
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
              style={styles.interviewButtonWrapper}>
              <LinearGradient
                colors={[colors.primaryStart, colors.primaryEnd]}
                style={styles.interviewButton}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}>
                <Icon
                  name="navigate"
                  size={ICON_SIZES.md}
                  color="#FFFFFF"
                  style={{marginRight: 8}}
                />
                <Text style={styles.interviewButtonText}>
                  Ready for Interview Practice
                </Text>
                <Icon
                  name="arrow-forward"
                  size={ICON_SIZES.md}
                  color="#FFFFFF"
                  style={{marginLeft: 4}}
                />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>

      {/* Suggestion Selection & PDF Update Modal */}
      <ApplySuggestionsModal
        visible={showApplyModal}
        improvements={improvements}
        missingSkills={analysis.skills_missing || []}
        isGenerating={isGeneratingPdf}
        progressMessage={generateProgress}
        onClose={() => setShowApplyModal(false)}
        onGenerate={handleGenerateUpdatedPdf}
      />

      {/* Side-by-Side Updated vs Original PDF Preview Modal */}
      <PdfPreviewModal
        visible={showPreviewModal}
        fileUri={previewUpdatedUri}
        compareOriginalUri={previewOrigUri}
        fileName={updatedPdfInfo?.fileName || 'Updated_Resume.pdf'}
        onClose={() => setShowPreviewModal(false)}
        onDownload={activeUri => handleDownloadUpdatedPdf(activeUri)}
        onShare={activeUri => handleShareUpdatedPdf(activeUri)}
        confirmLabel="Done"
      />

      {/* Paywall & Subscription Modal */}
      <PaywallModal
        visible={showPaywall}
        currentCredits={creditsRemaining}
        isPro={isPro}
        reason={paywallReason}
        onClose={closePaywall}
        onSuccess={refreshQuota}
      />
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
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    letterSpacing: -0.3,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  roleBanner: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
  },
  roleBannerTopRow: {
    marginBottom: SPACING.xs,
  },
  roleBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 5,
  },
  roleLabel: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  roleTitle: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  sourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.sm,
  },
  fileIconPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileSub: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    maxWidth: 160,
  },
  previewBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  previewBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
  },
  deltaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  deltaText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
  },
  heroCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  summaryBox: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    width: '100%',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  summaryTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  breakdownGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 6,
  },
  breakdownItem: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownScore: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    marginTop: 4,
    marginBottom: 2,
  },
  breakdownLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 10.5,
    textAlign: 'center',
    lineHeight: 14,
  },
  pdfUpdaterCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1.2,
    marginBottom: SPACING.lg,
  },
  pdfNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  pdfCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  pdfIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  pdfUpdaterTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    letterSpacing: -0.2,
  },
  pdfReadyPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  pdfReadyPillText: {
    fontFamily: FONTS.extraBold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  pdfUpdaterSub: {
    fontFamily: FONTS.medium,
    fontSize: 11.5,
    marginTop: 2,
  },
  pdfUpdaterDesc: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  changesBox: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    gap: 5,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  changeText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 11.5,
    lineHeight: 16,
  },
  pdfActionsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  pdfActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  pdfActionBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 12.5,
  },
  rescoreWrapper: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginTop: 2,
  },
  rescoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  rescoreBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13.5,
    color: '#FFFFFF',
  },
  customizeLinkBtn: {
    marginTop: SPACING.sm,
    alignItems: 'center',
    paddingVertical: 4,
  },
  customizeLinkText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },
  applyPrimaryWrapper: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  applyPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  applyPrimaryBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabButtonActive: {
    borderWidth: 1,
  },
  tabText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    textAlign: 'center',
  },
  sectionContainer: {
    marginBottom: SPACING.lg,
  },
  progressRow: {
    marginBottom: SPACING.md,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
  },
  progressCount: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: SPACING.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 5,
  },
  filterDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  filterChipText: {
    fontSize: 11,
  },
  skillsCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
  },
  skillsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  skillsTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
  },
  skillsSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    marginBottom: SPACING.md,
    lineHeight: 17,
  },
  skillsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillMatchedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  skillMatchedText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },
  skillMissingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  skillMissingText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },
  emptyText: {
    fontFamily: FONTS.italic,
    fontSize: 12,
  },
  strengthsCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
  },
  strengthsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  strengthsIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  strengthsTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
  },
  strengthsSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    marginBottom: SPACING.md,
    lineHeight: 17,
  },
  strengthItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  strengthBulletPill: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 1,
  },
  strengthText: {
    fontFamily: FONTS.medium,
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  bottomActions: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  viewDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  viewDocBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  rescanButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
  },
  interviewButtonWrapper: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  interviewButton: {
    flexDirection: 'row',
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  interviewButtonText: {
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    fontSize: 15,
  },
});

export default CVScoreResultScreen;
