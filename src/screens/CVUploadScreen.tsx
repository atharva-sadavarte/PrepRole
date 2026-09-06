import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  Animated,
  ActivityIndicator,
  Alert,
  Platform,
  TurboModuleRegistry,
  NativeModules,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useTheme} from '../context/ThemeContext';
import {COLORS, RADIUS, SPACING, ICON_SIZES, FONTS} from '../lib/theme';
import {analyzeCVWithAI} from '../services/aiService';
import {
  saveAnalysis,
  uploadResumeFile,
  openResumeInViewer,
} from '../services/resumeService';
import {getPdfBase64} from '../services/pdfService';
import Icon from '../components/Icon';
import PdfPreviewModal from '../components/PdfPreviewModal';
import type {Session} from '@supabase/supabase-js';

interface CVUploadScreenProps {
  session: Session;
  navigation: any;
}

const POPULAR_ROLES = [
  'Full Stack Developer',
  'React Native Engineer',
  'Frontend Engineer',
  'Backend Developer',
  'DevOps Engineer',
  'Data Scientist',
  'Product Manager',
];

const LOADING_STEPS = [
  'Scanning CV content & structure...',
  'Benchmarking skills against role...',
  'Evaluating quantifiable metrics & impact...',
  'Assessing ATS readability & keywords...',
  'Crafting personalized improvement plan...',
];

export const CVUploadScreen: React.FC<CVUploadScreenProps> = ({
  session,
  navigation,
}) => {
  const {colors, isDark} = useTheme();
  const [targetRole, setTargetRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [showJDInput, setShowJDInput] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('paste');
  const [pastedText, setPastedText] = useState('');
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    uri: string;
    size?: number;
    type?: string;
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Cycle loading messages
  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % LOADING_STEPS.length);
      }, 2000);

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
    return () => clearInterval(interval);
  }, [loading, pulseAnim]);

  const handlePickDocument = async () => {
    try {
      const isAvailable =
        !!TurboModuleRegistry?.get?.('RNDocumentPicker') ||
        !!NativeModules?.RNDocumentPicker;

      if (!isAvailable) {
        Alert.alert(
          'Document Picker Unavailable',
          'Document picking is not available. Please switch to the "Paste Text" tab to paste your resume content directly.',
          [
            {
              text: 'Switch to Paste Text',
              onPress: () => setActiveTab('paste'),
            },
            {text: 'Cancel', style: 'cancel'},
          ],
        );
        return;
      }

      // Dynamically load to avoid TurboModuleRegistry getEnforcing invariant crash
      const {pick: pickDoc, types: docTypes} = require('@react-native-documents/picker');
      const [res] = await pickDoc({
        type: [docTypes.pdf, docTypes.docx, docTypes.plainText],
        mode: 'open',
      });

      if (res) {
        setSelectedFile({
          name: res.name || 'Resume Document',
          uri: res.uri,
          size: res.size || undefined,
          type: res.type || undefined,
        });
      }
    } catch (err: any) {
      if (err?.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('File pick error:', err);
        Alert.alert(
          'File Picker Notice',
          'Could not pick file. Please switch to the "Paste Text" tab to paste your resume text.',
        );
      }
    }
  };

  const handlePreviewSelectedFile = () => {
    if (!selectedFile?.uri) return;
    setShowPdfPreview(true);
  };

  const handleAnalyze = async () => {
    if (!targetRole.trim()) {
      Alert.alert('Required Field', 'Please specify your target job role.');
      return;
    }

    const hasPastedText = pastedText.trim().length > 50;
    const hasFile = selectedFile !== null;

    if (!hasPastedText && !hasFile) {
      Alert.alert(
        'CV Required',
        'Please upload a resume file or paste your resume text to continue.',
      );
      return;
    }

    setLoading(true);
    setLoadingStep(0);

    try {
      let cvContent = hasPastedText ? pastedText.trim() : undefined;
      let pdfBase64: string | undefined;

      // Extract binary PDF base64 if a file was selected
      if (hasFile && selectedFile?.uri) {
        try {
          pdfBase64 = await getPdfBase64(selectedFile.uri);
        } catch (readErr: any) {
          console.error('Failed to read PDF as base64:', readErr);
        }
      }

      // If user provided neither readable PDF nor pasted text, notify user
      if (!cvContent && !pdfBase64) {
        setLoading(false);
        Alert.alert(
          'Resume Unreadable',
          'Unable to read resume content from the selected file. Please make sure it is a valid PDF document or switch to the "Paste Text" tab.',
        );
        return;
      }

      const result = await analyzeCVWithAI({
        cvText: cvContent,
        pdfBase64,
        targetRole: targetRole.trim(),
        jobDescription: jobDescription.trim() || undefined,
      });

      // Upload physical document to Supabase Storage if picked
      let uploadedFilePath: string | undefined;
      if (selectedFile) {
        const uploadRes = await uploadResumeFile(
          session.user.id,
          selectedFile.uri,
          selectedFile.name,
          selectedFile.type,
        );
        if (uploadRes?.path) {
          uploadedFilePath = uploadRes.path;
        }
      }

      // Save to Supabase DB
      const savedRecord = await saveAnalysis(
        session.user.id,
        result,
        selectedFile?.name || 'Pasted Resume',
        uploadedFilePath,
      );

      setLoading(false);

      // Navigate to result screen with the analysis
      navigation.navigate('CVScoreResult', {
        analysis: savedRecord,
      });
    } catch (error: any) {
      setLoading(false);
      Alert.alert(
        'Analysis Failed',
        error?.message || 'Failed to analyze CV. Please check your connection and try again.',
      );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={[colors.bgDark, colors.gradientMiddle, colors.gradientEnd]}
        style={styles.gradient}>
        {/* Header */}
        <View style={[styles.header, {borderBottomColor: colors.border}]}>
          <View style={styles.headerTopRow}>
            <View
              style={[
                styles.headerBadgePill,
                {backgroundColor: colors.bgCard, borderColor: colors.border},
              ]}>
              <View
                style={[
                  styles.headerSparkleBg,
                  {backgroundColor: colors.accentSoft},
                ]}>
                <Icon name="sparkles" size={11} color={colors.accent} />
              </View>
              <Text style={[styles.headerBadgeText, {color: colors.textPrimary}]}>
                AI CV BENCHMARK
              </Text>
            </View>
          </View>

          <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
            AI Resume Analyzer
          </Text>
          <Text style={[styles.headerSubtitle, {color: colors.textSecondary}]}>
            Scan resume content against target roles for instant ATS keyword & score evaluation.
          </Text>

          {/* Stepper bar */}
          <View style={styles.stepperContainer}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepDot,
                  {backgroundColor: colors.primaryStart},
                ]}>
                <Text style={styles.stepDotText}>1</Text>
              </View>
              <Text style={[styles.stepItemLabel, {color: colors.textPrimary}]}>
                Role & JD
              </Text>
            </View>
            <View
              style={[
                styles.stepLine,
                {
                  backgroundColor:
                    targetRole.trim().length > 0
                      ? colors.primaryStart
                      : colors.border,
                },
              ]}
            />
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepDot,
                  {
                    backgroundColor:
                      (activeTab === 'upload' && selectedFile) ||
                      (activeTab === 'paste' && pastedText.trim().length > 0)
                        ? colors.primaryStart
                        : colors.bgCardLight,
                    borderWidth: 1,
                    borderColor: colors.border,
                  },
                ]}>
                <Text
                  style={[
                    styles.stepDotText,
                    {
                      color:
                        (activeTab === 'upload' && selectedFile) ||
                        (activeTab === 'paste' && pastedText.trim().length > 0)
                          ? '#FFFFFF'
                          : colors.textMuted,
                    },
                  ]}>
                  2
                </Text>
              </View>
              <Text style={[styles.stepItemLabel, {color: colors.textSecondary}]}>
                Resume Content
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <Animated.View style={{opacity: fadeAnim}}>
            {/* Step 1: Target Role */}
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                  shadowColor: colors.cardShadow,
                  elevation: isDark ? 2 : 4,
                },
              ]}>
              <View style={styles.sectionHeader}>
                <View style={styles.stepBadgeContainer}>
                  <LinearGradient
                    colors={[colors.primaryStart, colors.primaryEnd]}
                    style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>1</Text>
                  </LinearGradient>
                </View>
                <Text
                  style={[
                    styles.sectionTitle,
                    {color: colors.textPrimary},
                  ]}>
                  Target Job Role
                </Text>
                <Text style={styles.requiredStar}>*</Text>
              </View>
              <Text
                style={[
                  styles.sectionSubtitle,
                  {color: colors.textSecondary},
                ]}>
                What role are you targeting? AI will benchmark your CV against this.
              </Text>

              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.bgInput,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                placeholder="e.g. Senior Full Stack Engineer"
                placeholderTextColor={colors.textMuted}
                value={targetRole}
                onChangeText={setTargetRole}
              />

              {/* Quick Role Chips */}
              <Text
                style={[
                  styles.chipsLabel,
                  {color: colors.textMuted},
                ]}>
                Popular Roles:
              </Text>
              <View style={styles.chipsContainer}>
                {POPULAR_ROLES.map((role, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.roleChip,
                      {
                        backgroundColor: colors.bgCardLight,
                        borderColor: colors.border,
                      },
                      targetRole === role && {
                        backgroundColor: colors.accentSoft,
                        borderColor: colors.accent,
                      },
                    ]}
                    onPress={() => setTargetRole(role)}>
                    <Text
                      style={[
                        styles.roleChipText,
                        {color: colors.textSecondary},
                        targetRole === role && {
                          color: colors.accent,
                          fontWeight: '700',
                        },
                      ]}>
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Step 2: Optional Job Description */}
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                  shadowColor: colors.cardShadow,
                  elevation: isDark ? 2 : 4,
                },
              ]}>
              <TouchableOpacity
                onPress={() => setShowJDInput(!showJDInput)}
                style={styles.accordionHeader}
                activeOpacity={0.7}>
                <View style={styles.accordionLeft}>
                  <View style={styles.stepBadgeContainer}>
                    <View
                      style={[
                        styles.stepBadgeOptional,
                        {backgroundColor: colors.bgCardLight},
                      ]}>
                      <Text
                        style={[
                          styles.stepBadgeOptionalText,
                          {color: colors.textSecondary},
                        ]}>
                        2
                      </Text>
                    </View>
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.sectionTitle,
                        {color: colors.textPrimary},
                      ]}>
                      Job Description
                    </Text>
                    <Text
                      style={[
                        styles.optionalTag,
                        {color: colors.textMuted},
                      ]}>
                      Optional - Match specific job posting
                    </Text>
                  </View>
                </View>
                <Icon
                  name={showJDInput ? 'chevron-up' : 'chevron-down'}
                  size={ICON_SIZES.md}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {showJDInput && (
                <View style={styles.accordionContent}>
                  <Text
                    style={[
                      styles.sectionSubtitle,
                      {color: colors.textSecondary},
                    ]}>
                    Paste the job description from LinkedIn, Indeed, etc. for laser-focused keyword matching.
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      styles.textArea,
                      {
                        backgroundColor: colors.bgInput,
                        borderColor: colors.border,
                        color: colors.textPrimary,
                      },
                    ]}
                    placeholder="Paste the job description, requirements, or responsibilities here..."
                    placeholderTextColor={colors.textMuted}
                    value={jobDescription}
                    onChangeText={setJobDescription}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              )}
            </View>

            {/* Step 3: CV Source */}
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                  shadowColor: colors.cardShadow,
                  elevation: isDark ? 2 : 4,
                },
              ]}>
              <View style={styles.sectionHeader}>
                <View style={styles.stepBadgeContainer}>
                  <LinearGradient
                    colors={[colors.primaryStart, colors.primaryEnd]}
                    style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>3</Text>
                  </LinearGradient>
                </View>
                <Text
                  style={[
                    styles.sectionTitle,
                    {color: colors.textPrimary},
                  ]}>
                  Your Resume / CV
                </Text>
                <Text style={styles.requiredStar}>*</Text>
              </View>

              {/* Tab Selector */}
              <View
                style={[
                  styles.tabsContainer,
                  {
                    backgroundColor: colors.bgInput,
                    borderColor: colors.border,
                  },
                ]}>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === 'upload' && [
                      styles.tabButtonActive,
                      {
                        backgroundColor: colors.bgCard,
                        borderColor: colors.border,
                      },
                    ],
                  ]}
                  onPress={() => setActiveTab('upload')}>
                  <Icon
                    name="cloud-upload-outline"
                    size={ICON_SIZES.sm}
                    color={
                      activeTab === 'upload'
                        ? colors.primaryStart
                        : colors.textSecondary
                    }
                    style={{marginRight: 4}}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      {color: colors.textSecondary},
                      activeTab === 'upload' && {
                        color: colors.primaryStart,
                        fontWeight: '700',
                      },
                    ]}>
                    Upload
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === 'paste' && [
                      styles.tabButtonActive,
                      {
                        backgroundColor: colors.bgCard,
                        borderColor: colors.border,
                      },
                    ],
                  ]}
                  onPress={() => setActiveTab('paste')}>
                  <Icon
                    name="clipboard-outline"
                    size={ICON_SIZES.sm}
                    color={
                      activeTab === 'paste'
                        ? colors.primaryStart
                        : colors.textSecondary
                    }
                    style={{marginRight: 4}}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      {color: colors.textSecondary},
                      activeTab === 'paste' && {
                        color: colors.primaryStart,
                        fontWeight: '700',
                      },
                    ]}>
                    Paste Text
                  </Text>
                </TouchableOpacity>
              </View>

              {activeTab === 'upload' ? (
                <View style={styles.uploadArea}>
                  {selectedFile ? (
                    <View
                      style={[
                        styles.fileCard,
                        {
                          backgroundColor: colors.bgInput,
                          borderColor: colors.border,
                        },
                      ]}>
                      <Icon
                        name="document"
                        size={ICON_SIZES.lg}
                        color={colors.primaryStart}
                        style={{marginRight: SPACING.sm}}
                      />
                      <View style={styles.fileDetails}>
                        <Text
                          style={[
                            styles.fileName,
                            {color: colors.textPrimary},
                          ]}
                          numberOfLines={1}>
                          {selectedFile.name}
                        </Text>
                        <Text
                          style={[
                            styles.fileSize,
                            {color: colors.textSecondary},
                          ]}>
                          {selectedFile.size
                            ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                            : 'Ready to analyze'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={handlePreviewSelectedFile}
                        disabled={previewing}
                        style={styles.filePreviewBtn}
                        activeOpacity={0.7}>
                        {previewing ? (
                          <ActivityIndicator size="small" color={colors.accent} />
                        ) : (
                          <Icon
                            name="eye-outline"
                            size={ICON_SIZES.md}
                            color={colors.accent}
                          />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setSelectedFile(null)}
                        style={styles.fileRemoveBtn}>
                        <Icon
                          name="close-circle"
                          size={ICON_SIZES.lg}
                          color={colors.error}
                        />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={handlePickDocument}
                      style={[
                        styles.uploadDottedBox,
                        {
                          backgroundColor: colors.bgInput,
                          borderColor: colors.border,
                        },
                      ]}
                      activeOpacity={0.7}>
                      <Icon
                        name="cloud-upload"
                        size={ICON_SIZES.hero}
                        color={colors.primaryStart}
                        style={{marginBottom: SPACING.xs}}
                      />
                      <Text
                        style={[
                          styles.uploadTitle,
                          {color: colors.textPrimary},
                        ]}>
                        Select PDF, DOCX or TXT file
                      </Text>
                      <Text
                        style={[
                          styles.uploadSubtitle,
                          {color: colors.textSecondary},
                        ]}>
                        Tap to browse files from device
                      </Text>
                      <View
                        style={[
                          styles.browseButton,
                          {backgroundColor: colors.primaryStart},
                        ]}>
                        <Text style={styles.browseButtonText}>Browse File</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={styles.pasteArea}>
                  <TextInput
                    style={[
                      styles.textInput,
                      styles.cvTextArea,
                      {
                        backgroundColor: colors.bgInput,
                        borderColor: colors.border,
                        color: colors.textPrimary,
                      },
                    ]}
                    placeholder="Paste your CV text here (Summary, Skills, Work Experience, Education)..."
                    placeholderTextColor={colors.textMuted}
                    value={pastedText}
                    onChangeText={setPastedText}
                    multiline
                    numberOfLines={8}
                    textAlignVertical="top"
                  />
                  <View style={styles.pasteFooter}>
                    <Text
                      style={[
                        styles.charCount,
                        {color: colors.textMuted},
                      ]}>
                      {pastedText.length} characters
                    </Text>
                    {pastedText.length > 0 && (
                      <TouchableOpacity onPress={() => setPastedText('')}>
                        <Text
                          style={[
                            styles.clearTextLink,
                            {color: colors.accent},
                          ]}>
                          Clear Text
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* Analyze Action Button */}
            <TouchableOpacity
              onPress={handleAnalyze}
              disabled={loading}
              activeOpacity={0.85}
              style={styles.analyzeButtonWrapper}>
              <LinearGradient
                colors={[colors.primaryStart, colors.primaryEnd]}
                style={styles.analyzeButton}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}>
                <Icon
                  name="flash"
                  size={ICON_SIZES.lg}
                  color="#FFFFFF"
                  style={{marginRight: SPACING.sm}}
                />
                <Text style={styles.analyzeButtonText}>
                  Analyze & Score Resume
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>

        {/* Loading Overlay */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <Animated.View
              style={[
                styles.loadingContent,
                {transform: [{scale: pulseAnim}]},
              ]}>
              <LinearGradient
                colors={[colors.primaryStart, colors.primaryEnd]}
                style={styles.loadingCircle}>
                <Icon name="flash" size={36} color="#FFFFFF" />
              </LinearGradient>
              <ActivityIndicator
                size="large"
                color={colors.accent}
                style={{marginVertical: SPACING.md}}
              />
              <Text style={styles.loadingTitle}>AI Career Coach at Work</Text>
              <Text style={styles.loadingStepText}>
                {LOADING_STEPS[loadingStep]}
              </Text>
            </Animated.View>
          </View>
        )}
      </LinearGradient>

      {/* In-App Native PDF Preview Modal */}
      <PdfPreviewModal
        visible={showPdfPreview}
        fileUri={selectedFile?.uri || null}
        fileName={selectedFile?.name}
        fileSize={selectedFile?.size}
        onClose={() => setShowPdfPreview(false)}
        onReplaceFile={handlePickDocument}
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
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl + 8,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  headerBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  headerSparkleBg: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  headerBadgeText: {
    fontFamily: FONTS.extraBold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    letterSpacing: -0.5,
    marginTop: 4,
    marginBottom: 3,
  },
  headerSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: SPACING.md,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotText: {
    fontFamily: FONTS.extraBold,
    color: '#FFFFFF',
    fontSize: 10,
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: SPACING.sm,
    borderRadius: 1,
  },
  stepItemLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl * 2,
  },
  sectionCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepBadgeContainer: {
    marginRight: 8,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBadgeText: {
    fontFamily: FONTS.extraBold,
    color: '#fff',
    fontSize: 11,
  },
  stepBadgeOptional: {
    backgroundColor: COLORS.bgCardLight,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBadgeOptionalText: {
    fontFamily: FONTS.extraBold,
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  requiredStar: {
    color: COLORS.error,
    fontSize: 16,
    marginLeft: 4,
  },
  sectionSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 16,
  },
  textInput: {
    fontFamily: FONTS.regular,
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  cvTextArea: {
    height: 180,
    paddingTop: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
  chipsLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    backgroundColor: COLORS.bgCardLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleChipActive: {
    backgroundColor: 'rgba(108, 99, 255, 0.2)',
    borderColor: COLORS.primaryStart,
  },
  roleChipText: {
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  roleChipTextActive: {
    fontFamily: FONTS.bold,
    color: COLORS.accent,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accordionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionalTag: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  accordionContent: {
    marginTop: SPACING.md,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCardLight,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: SPACING.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: COLORS.bgCard,
  },
  tabText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  uploadArea: {
    marginTop: SPACING.xs,
  },
  uploadDottedBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.primaryStart,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  uploadTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  uploadSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  browseButton: {
    backgroundColor: COLORS.primaryStart,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  browseButtonText: {
    fontFamily: FONTS.semiBold,
    color: '#fff',
    fontSize: 12,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primaryStart,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  fileSize: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  fileRemoveBtn: {
    padding: 6,
  },
  filePreviewBtn: {
    backgroundColor: 'rgba(166, 124, 82, 0.12)',
    borderWidth: 1,
    borderColor: COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    marginRight: SPACING.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pasteArea: {
    marginTop: SPACING.xs,
  },
  pasteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  charCount: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  clearTextLink: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
  analyzeButtonWrapper: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    shadowColor: COLORS.primaryStart,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  analyzeButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  analyzeButtonText: {
    fontFamily: FONTS.extraBold,
    color: '#fff',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(18, 17, 16, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    zIndex: 999,
  },
  loadingContent: {
    alignItems: 'center',
    maxWidth: 320,
  },
  loadingCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primaryStart,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 20,
  },
  loadingTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  loadingStepText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.accent,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default CVUploadScreen;
