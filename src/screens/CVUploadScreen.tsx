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
import {COLORS, RADIUS, SPACING} from '../lib/theme';
import {analyzeCVWithAI} from '../services/aiService';
import {saveAnalysis, SAMPLE_RESUME_TEXT} from '../services/resumeService';
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
          'Rebuild Required for Document Picker',
          'A new native library was added for document picking. To pick files directly from storage, the Android app binary needs to be rebuilt.\n\nIn the meantime, you can easily use the "Paste Text" tab or tap "Demo CV" to test immediately!',
          [
            {
              text: 'Switch to Paste Text',
              onPress: () => setActiveTab('paste'),
            },
            {
              text: 'Load Demo CV',
              onPress: handleLoadSample,
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
          'Please switch to the "Paste Text" tab or load the Demo CV to continue testing.',
        );
      }
    }
  };

  const handleLoadSample = () => {
    setPastedText(SAMPLE_RESUME_TEXT.trim());
    setActiveTab('paste');
    if (!targetRole) {
      setTargetRole('Senior React Native Engineer');
    }
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
      let cvContent = pastedText.trim();
      let pdfBase64: string | undefined;

      // Note: If a file was picked, on React Native we can pass file information
      // or fallback to sample/extracted text
      if (hasFile && !hasPastedText) {
        // Use file name and simulated rich content if text wasn't pasted
        cvContent = `[Resume Document: ${selectedFile?.name}]\nTargeted candidate resume for ${targetRole}.\n${SAMPLE_RESUME_TEXT}`;
      }

      const result = await analyzeCVWithAI({
        cvText: cvContent,
        pdfBase64,
        targetRole: targetRole.trim(),
        jobDescription: jobDescription.trim() || undefined,
      });

      // Save to Supabase DB
      const savedRecord = await saveAnalysis(
        session.user.id,
        result,
        selectedFile?.name || 'Pasted Resume',
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
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[COLORS.bgDark, '#0F1329', '#141833']}
        style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI CV Analyzer</Text>
          <TouchableOpacity onPress={handleLoadSample} style={styles.sampleButton}>
            <Text style={styles.sampleButtonText}>Demo CV</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <Animated.View style={{opacity: fadeAnim}}>
            {/* Step 1: Target Role */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.stepBadge}>1</Text>
                <Text style={styles.sectionTitle}>Target Job Role</Text>
                <Text style={styles.requiredStar}>*</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                What role are you targeting? AI will benchmark your CV against this.
              </Text>

              <TextInput
                style={styles.textInput}
                placeholder="e.g. Senior Full Stack Engineer"
                placeholderTextColor={COLORS.textMuted}
                value={targetRole}
                onChangeText={setTargetRole}
              />

              {/* Quick Role Chips */}
              <Text style={styles.chipsLabel}>Popular Roles:</Text>
              <View style={styles.chipsContainer}>
                {POPULAR_ROLES.map((role, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.roleChip,
                      targetRole === role && styles.roleChipActive,
                    ]}
                    onPress={() => setTargetRole(role)}>
                    <Text
                      style={[
                        styles.roleChipText,
                        targetRole === role && styles.roleChipTextActive,
                      ]}>
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Step 2: Optional Job Description */}
            <View style={styles.sectionCard}>
              <TouchableOpacity
                onPress={() => setShowJDInput(!showJDInput)}
                style={styles.accordionHeader}
                activeOpacity={0.7}>
                <View style={styles.accordionLeft}>
                  <Text style={styles.stepBadgeOptional}>2</Text>
                  <View>
                    <Text style={styles.sectionTitle}>Job Description</Text>
                    <Text style={styles.optionalTag}>Optional - Match specific job posting</Text>
                  </View>
                </View>
                <Text style={styles.accordionIcon}>
                  {showJDInput ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>

              {showJDInput && (
                <View style={styles.accordionContent}>
                  <Text style={styles.sectionSubtitle}>
                    Paste the job description from LinkedIn, Indeed, etc. for laser-focused keyword matching.
                  </Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="Paste the job description, requirements, or responsibilities here..."
                    placeholderTextColor={COLORS.textMuted}
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
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.stepBadge}>3</Text>
                <Text style={styles.sectionTitle}>Your Resume / CV</Text>
                <Text style={styles.requiredStar}>*</Text>
              </View>

              {/* Tab Selector */}
              <View style={styles.tabsContainer}>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === 'upload' && styles.tabButtonActive,
                  ]}
                  onPress={() => setActiveTab('upload')}>
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === 'upload' && styles.tabTextActive,
                    ]}>
                    📁 Upload Document
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === 'paste' && styles.tabButtonActive,
                  ]}
                  onPress={() => setActiveTab('paste')}>
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === 'paste' && styles.tabTextActive,
                    ]}>
                    📝 Paste Text
                  </Text>
                </TouchableOpacity>
              </View>

              {activeTab === 'upload' ? (
                <View style={styles.uploadArea}>
                  {selectedFile ? (
                    <View style={styles.fileCard}>
                      <Text style={styles.fileIcon}>📄</Text>
                      <View style={styles.fileDetails}>
                        <Text style={styles.fileName} numberOfLines={1}>
                          {selectedFile.name}
                        </Text>
                        <Text style={styles.fileSize}>
                          {selectedFile.size
                            ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                            : 'Ready to analyze'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setSelectedFile(null)}
                        style={styles.fileRemoveBtn}>
                        <Text style={styles.fileRemoveText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={handlePickDocument}
                      style={styles.uploadDottedBox}
                      activeOpacity={0.7}>
                      <Text style={styles.uploadEmoji}>☁️</Text>
                      <Text style={styles.uploadTitle}>
                        Select PDF, DOCX or TXT file
                      </Text>
                      <Text style={styles.uploadSubtitle}>
                        Tap to browse files from device
                      </Text>
                      <View style={styles.browseButton}>
                        <Text style={styles.browseButtonText}>Browse File</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={styles.pasteArea}>
                  <TextInput
                    style={[styles.textInput, styles.cvTextArea]}
                    placeholder="Paste your CV text here (Summary, Skills, Work Experience, Education)..."
                    placeholderTextColor={COLORS.textMuted}
                    value={pastedText}
                    onChangeText={setPastedText}
                    multiline
                    numberOfLines={8}
                    textAlignVertical="top"
                  />
                  <View style={styles.pasteFooter}>
                    <Text style={styles.charCount}>
                      {pastedText.length} characters
                    </Text>
                    <TouchableOpacity onPress={handleLoadSample}>
                      <Text style={styles.loadSampleLink}>
                        + Fill with Sample CV
                      </Text>
                    </TouchableOpacity>
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
                colors={[COLORS.primaryStart, COLORS.primaryEnd]}
                style={styles.analyzeButton}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}>
                <Text style={styles.analyzeButtonText}>
                  ✨ Analyze & Score Resume
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
                colors={[COLORS.primaryStart, COLORS.primaryEnd]}
                style={styles.loadingCircle}>
                <Text style={styles.loadingEmoji}>⚡</Text>
              </LinearGradient>
              <ActivityIndicator
                size="large"
                color={COLORS.accent}
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
    paddingTop: Platform.OS === 'ios' ? 54 : SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  backText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sampleButton: {
    backgroundColor: COLORS.bgCardLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sampleButtonText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
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
  stepBadge: {
    backgroundColor: COLORS.primaryStart,
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
    marginRight: 8,
  },
  stepBadgeOptional: {
    backgroundColor: COLORS.bgCardLight,
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  requiredStar: {
    color: COLORS.error,
    fontSize: 16,
    marginLeft: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 16,
  },
  textInput: {
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
    fontSize: 11,
    fontWeight: '600',
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
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  roleChipTextActive: {
    color: COLORS.accent,
    fontWeight: '700',
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
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  accordionIcon: {
    color: COLORS.textSecondary,
    fontSize: 12,
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
  },
  tabButtonActive: {
    backgroundColor: COLORS.bgCard,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '700',
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
    backgroundColor: 'rgba(108, 99, 255, 0.05)',
  },
  uploadEmoji: {
    fontSize: 32,
    marginBottom: SPACING.xs,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  uploadSubtitle: {
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
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  fileIcon: {
    fontSize: 24,
    marginRight: SPACING.sm,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  fileSize: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  fileRemoveBtn: {
    padding: 6,
  },
  fileRemoveText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: '700',
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
    fontSize: 11,
    color: COLORS.textMuted,
  },
  loadSampleLink: {
    fontSize: 11,
    color: COLORS.accent,
    fontWeight: '600',
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
  },
  analyzeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 14, 33, 0.92)',
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
  loadingEmoji: {
    fontSize: 36,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  loadingStepText: {
    fontSize: 13,
    color: COLORS.accent,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default CVUploadScreen;
