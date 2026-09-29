import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../context/ThemeContext';
import {SPACING, RADIUS, FONTS} from '../../lib/theme';
import Icon from '../../components/Icon';
import type {Session} from '@supabase/supabase-js';
import {
  InterviewJourney,
  JourneyRound,
  InterviewAttempt,
} from '../../types/interviewCoach';
import {
  getJourneyById,
  saveInterviewJourney,
  saveInterviewAttempt,
  checkR1Skippable,
  gradeInterviewAttempt,
  setAutoResumeSuppressed,
  transcribeUserAudioWithGemini,
} from '../../services/interviewCoachService';
import {
  requestAudioPermission,
  startNativeAudioRecording,
  stopNativeAudioRecording,
  cancelNativeAudioRecording,
  playNativeAudio,
  stopNativeAudio,
  speakQuestionText,
  stopQuestionSpeech,
  readMediaFileAsBase64,
} from '../../services/interviewMediaService';

interface InterviewSessionScreenProps {
  route: {
    params: {
      journeyId: string;
      jobRole: string;
      isFirstTimeJobRole?: boolean;
    };
  };
  navigation: any;
  session: Session;
}

export const InterviewSessionScreen: React.FC<InterviewSessionScreenProps> = ({
  route,
  navigation,
  session,
}) => {
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();
  const userId = session?.user?.id || 'guest_user';
  const {journeyId, jobRole, isFirstTimeJobRole} = route.params;

  // Journey state
  const [journey, setJourney] = useState<InterviewJourney | null>(null);
  const [loading, setLoading] = useState(true);

  // Active View: 'dashboard' or 'practice'
  const [activeView, setActiveView] = useState<'dashboard' | 'practice'>('dashboard');
  const [selectedRound, setSelectedRound] = useState<JourneyRound | null>(null);

  // Practice state
  const [hasPlayedQuestion, setHasPlayedQuestion] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioPromptToast, setAudioPromptToast] = useState<string | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);

  // Review & Edit Transcript state
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordedBase64, setRecordedBase64] = useState<string | null>(null);
  const [isSubmittingAttempt, setIsSubmittingAttempt] = useState(false);

  // Warm-up skip eligibility
  const [canSkipWarmup, setCanSkipWarmup] = useState(false);

  // First-time drop-off survey modal
  const [showDropOffModal, setShowDropOffModal] = useState(false);

  // Timer Ref
  const timerRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadJourney();
    checkWarmupEligibility();
  }, [journeyId]);

  const loadJourney = async () => {
    setLoading(true);
    const data = await getJourneyById(userId, journeyId);
    if (data) {
      setJourney(data);
    }
    setLoading(false);
  };

  const checkWarmupEligibility = async () => {
    const eligible = await checkR1Skippable(userId);
    setCanSkipWarmup(eligible);
  };

  // Pulse animation for recording
  useEffect(() => {
    let loop: Animated.CompositeAnimation;
    if (isRecording) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => loop?.stop();
  }, [isRecording]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopNativeAudio();
      cancelNativeAudioRecording();
      stopQuestionSpeech();
    };
  }, []);

  // Back button handler with drop-off survey guard (Rule IC-3, IC-33)
  const handleBackPress = () => {
    if (activeView === 'practice') {
      if (isRecording) {
        cancelNativeAudioRecording();
        setIsRecording(false);
      }
      stopQuestionSpeech();
      setActiveView('dashboard');
      return;
    }

    // Check drop-off condition
    const q1NotAttempted = journey?.rounds[0]?.attemptsCount === 0;
    if (isFirstTimeJobRole && q1NotAttempted) {
      setShowDropOffModal(true);
      return;
    }

    setAutoResumeSuppressed(true);
    navigation.goBack();
  };

  // Skip warm-up round (Rule IC-21)
  const handleSkipWarmup = async () => {
    if (!journey) return;
    const updatedRounds = journey.rounds.map(r => {
      if (r.roundNumber === 1) {
        return {...r, status: 'skipped' as const, isSkipped: true};
      }
      if (r.roundNumber === 2 && r.status === 'locked') {
        return {...r, status: 'inProgress' as const};
      }
      return r;
    });

    const updatedJourney: InterviewJourney = {
      ...journey,
      currentRoundNumber: 2,
      rounds: updatedRounds,
    };

    setJourney(updatedJourney);
    await saveInterviewJourney(updatedJourney);
    Alert.alert('Warm-up Skipped', 'Round 1 marked as skipped. Round 2 is now unlocked!');
  };

  // Tap on a round in the timeline
  const handleRoundPress = (round: JourneyRound) => {
    if (round.status === 'locked') {
      Alert.alert(
        'Round Locked',
        'Complete the preceding rounds with a score of 3.0 or higher to unlock this round.',
      );
      return;
    }

    setSelectedRound(round);
    setHasPlayedQuestion(false);
    setRecordedUri(null);
    setTranscriptText('');
    setActiveView('practice');
  };

  // Play Question using TTS (Rule IC-23: must play at least once)
  const handlePlayQuestion = async () => {
    if (!selectedRound) return;
    setIsPlayingAudio(true);
    try {
      await speakQuestionText(selectedRound.question, journey?.language || 'en-US');
      setHasPlayedQuestion(true);
    } catch (e) {
      console.warn('TTS play error:', e);
      setHasPlayedQuestion(true);
    } finally {
      setIsPlayingAudio(false);
    }
  };

  // Start recording answer (Rule IC-24, IC-25)
  const handleStartRecording = async () => {
    if (!hasPlayedQuestion) {
      Alert.alert(
        'Listen to Question First',
        'Please listen to the interview question by tapping "Play Question" before starting your response.',
      );
      return;
    }

    const hasMic = await requestAudioPermission();
    if (!hasMic) {
      Alert.alert('Microphone Required', 'Microphone permission is needed to record your response.');
      return;
    }

    const started = await startNativeAudioRecording();
    if (!started) {
      Alert.alert('Recording Error', 'Could not initialize microphone recording.');
      return;
    }

    setIsRecording(true);
    setRecordingSeconds(0);
    setAudioPromptToast(null);

    timerRef.current = setInterval(() => {
      setRecordingSeconds(sec => {
        const next = sec + 1;
        // Prompts at 30s and 105s (Rule IC-25)
        if (next === 30) {
          setAudioPromptToast('Keep going! Elaborate with concrete examples.');
        } else if (next === 105) {
          setAudioPromptToast('Almost done! Wrap up your conclusion.');
        } else if (next >= 120) {
          // Auto-stop at 120s
          handleStopRecording();
        }
        return next;
      });
    }, 1000);
  };

  // Stop recording & open transcript review (Rule IC-26, IC-27)
  const handleStopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setAudioPromptToast(null);

    const result = await stopNativeAudioRecording(recordingSeconds);
    setRecordedUri(result.uri);

    setIsTranscribing(true);
    setShowTranscriptModal(true);
    setTranscriptText('');

    let b64 = result.base64;
    if (!b64 && result.uri) {
      b64 = await readMediaFileAsBase64(result.uri);
    }
    setRecordedBase64(b64 || null);

    try {
      if (b64 && b64.length > 50) {
        const transcribed = await transcribeUserAudioWithGemini(b64, journey?.language || 'en-US');
        if (transcribed && transcribed.trim().length > 0) {
          setTranscriptText(transcribed.trim());
        } else {
          setTranscriptText('');
          Alert.alert(
            'Speech Not Detected',
            'We could not detect clear words in the recording. You can type or review your response below, or tap Re-record.',
          );
        }
      } else {
        setTranscriptText('');
      }
    } catch (e: any) {
      console.warn('Speech transcription error:', e);
      setTranscriptText('');
      Alert.alert(
        'Transcription Service Busy',
        'Could not reach the AI speech service. Your audio was saved—you can type or review your response below, or tap Retry Transcribe.',
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleRetryTranscription = async () => {
    if (!recordedBase64 || isTranscribing) return;
    setIsTranscribing(true);
    try {
      const transcribed = await transcribeUserAudioWithGemini(recordedBase64, journey?.language || 'en-US');
      if (transcribed && transcribed.trim().length > 0) {
        setTranscriptText(transcribed.trim());
      } else {
        Alert.alert(
          'Speech Not Detected',
          'Could not detect spoken words in the recording. You can type your response below or tap Re-record.',
        );
      }
    } catch (e) {
      Alert.alert(
        'Transcription Service Busy',
        'Could not reach the AI speech service. You can type or edit your response directly.',
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  // Submit Answer Attempt (Rule IC-27, IC-30, IC-31)
  const handleSubmitAttempt = async () => {
    if (!selectedRound || !journey) return;
    if (!transcriptText.trim()) {
      Alert.alert('Response Empty', 'Please provide or edit your answer transcript before submitting.');
      return;
    }

    setIsSubmittingAttempt(true);

    try {
      const evaluation = await gradeInterviewAttempt(
        journey.jobRole,
        selectedRound.roundNumber,
        selectedRound.question,
        transcriptText.trim(),
        recordingSeconds || 60,
        recordedBase64 || undefined,
      );

      const attempt: InterviewAttempt = {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        journeyId: journey.id,
        roundNumber: selectedRound.roundNumber,
        question: selectedRound.question,
        userResponseText: transcriptText.trim(),
        audioUri: recordedUri || undefined,
        durationSeconds: recordingSeconds || 60,
        score: evaluation.score,
        passed: evaluation.passed,
        ratings: evaluation.ratings,
        feedback: evaluation.feedback,
        strengths: evaluation.strengths,
        improvements: evaluation.improvements,
        sampleAnswer: evaluation.sampleAnswer,
        audioMetrics: evaluation.audioMetrics,
        createdAt: new Date().toISOString(),
      };

      await saveInterviewAttempt(userId, attempt);

      // Update round status in journey
      const passed = evaluation.passed;
      const nextRounds = journey.rounds.map(r => {
        if (r.roundNumber === selectedRound.roundNumber) {
          return {
            ...r,
            status: passed ? ('completed' as const) : ('failed' as const),
            score: evaluation.score,
            attemptsCount: r.attemptsCount + 1,
          };
        }
        // Unlock next round if passed and previously locked
        if (passed && r.roundNumber === selectedRound.roundNumber + 1 && r.status === 'locked') {
          return {...r, status: 'inProgress' as const};
        }
        return r;
      });

      const allCompleted = nextRounds.every(
        r => r.status === 'completed' || r.status === 'skipped',
      );

      const updatedJourney: InterviewJourney = {
        ...journey,
        currentRoundNumber: passed
          ? Math.min(10, selectedRound.roundNumber + 1)
          : selectedRound.roundNumber,
        status: allCompleted ? 'completed' : 'inProgress',
        rounds: nextRounds,
      };

      setJourney(updatedJourney);
      await saveInterviewJourney(updatedJourney);

      setIsSubmittingAttempt(false);
      setShowTranscriptModal(false);
      setActiveView('dashboard');

      // Navigate to Feedback screen
      navigation.navigate('InterviewFeedback', {
        journeyId: journey.id,
        roundNumber: selectedRound.roundNumber,
        attempt,
        jobRole: journey.jobRole,
      });
    } catch (err) {
      setIsSubmittingAttempt(false);
      Alert.alert('Grading Error', 'Failed to score response. Please retry submitting.');
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (loading || !journey) {
    return (
      <View style={[styles.loadingContainer, {backgroundColor: colors.bgDark}]}>
        <ActivityIndicator size="large" color={colors.primaryStart} />
        <Text style={[styles.loadingText, {color: colors.textSecondary}]}>
          Loading Interview Journey...
        </Text>
      </View>
    );
  }

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
          onPress={handleBackPress}
          style={[styles.backBtn, {backgroundColor: colors.bgCard, borderColor: colors.border}]}
          activeOpacity={0.7}>
          <Icon name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, {color: colors.textPrimary}]} numberOfLines={1}>
            {journey.jobRole}
          </Text>
          <Text style={[styles.headerSubtitle, {color: colors.textSecondary}]}>
            {activeView === 'dashboard'
              ? `Journey Progress • Round ${journey.currentRoundNumber}/10`
              : `Round ${selectedRound?.roundNumber}: ${selectedRound?.levelLabel}`}
          </Text>
        </View>

        {activeView === 'practice' && (
          <TouchableOpacity
            onPress={() => setActiveView('dashboard')}
            style={[styles.closePracticeBtn, {borderColor: colors.border}]}>
            <Icon name="close" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
      </View>

      {/* DASHBOARD VIEW: 10 Rounds Timeline */}
      {activeView === 'dashboard' && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {paddingBottom: Math.max(insets.bottom, 20) + 40},
          ]}
          showsVerticalScrollIndicator={false}>
          {/* Journey Header Card */}
          <LinearGradient
            colors={['#1F2937', '#111827']}
            style={[styles.journeyStatusCard, {borderColor: colors.border}]}>
            <View style={styles.statusHeaderRow}>
              <View>
                <Text style={styles.statusTitle}>10-Round Interview Roadmap</Text>
                <Text style={styles.statusSub}>
                  Pass score: 3.0 / 5.0 • Real Trial at R10
                </Text>
              </View>
              {canSkipWarmup && journey.rounds[0]?.status === 'inProgress' && (
                <TouchableOpacity
                  onPress={handleSkipWarmup}
                  style={styles.skipWarmupBtn}
                  activeOpacity={0.8}>
                  <Text style={styles.skipWarmupText}>Skip R1 Warm-up</Text>
                </TouchableOpacity>
              )}
            </View>
          </LinearGradient>

          {/* Timeline of 10 rounds */}
          <View style={styles.timelineContainer}>
            {journey.rounds.map((round, idx) => {
              const isLocked = round.status === 'locked';
              const isPassed = round.status === 'completed';
              const isFailed = round.status === 'failed';
              const isSkipped = round.status === 'skipped';
              const isInProgress = round.status === 'inProgress';

              let badgeColor = colors.border;
              let badgeText = 'Locked';
              if (isPassed) {
                badgeColor = '#10B981';
                badgeText = `Passed (${round.score?.toFixed(1) || '3.5'})`;
              } else if (isFailed) {
                badgeColor = '#EF4444';
                badgeText = `Needs Retry (${round.score?.toFixed(1) || '2.0'})`;
              } else if (isSkipped) {
                badgeColor = '#6B7280';
                badgeText = 'Skipped';
              } else if (isInProgress) {
                badgeColor = colors.primaryStart;
                badgeText = 'Active';
              }

              return (
                <TouchableOpacity
                  key={round.roundNumber}
                  disabled={isLocked}
                  onPress={() => handleRoundPress(round)}
                  style={[
                    styles.roundRowCard,
                    {
                      backgroundColor: colors.bgCard,
                      borderColor: isInProgress ? colors.primaryStart : colors.border,
                      opacity: isLocked ? 0.5 : 1,
                    },
                  ]}
                  activeOpacity={0.8}>
                  <View style={styles.roundNumCol}>
                    <View
                      style={[
                        styles.roundNumCircle,
                        {
                          backgroundColor: isInProgress
                            ? colors.accentSoft
                            : isPassed
                            ? '#D1FAE5'
                            : colors.border,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.roundNumText,
                          {
                            color: isInProgress
                              ? colors.primaryStart
                              : isPassed
                              ? '#065F46'
                              : colors.textSecondary,
                          },
                        ]}>
                        R{round.roundNumber}
                      </Text>
                    </View>
                    {idx < 9 && <View style={[styles.timelineConnector, {backgroundColor: colors.border}]} />}
                  </View>

                  <View style={styles.roundInfoCol}>
                    <View style={styles.roundLevelRow}>
                      <Text style={[styles.levelLabel, {color: colors.primaryStart}]}>
                        {round.levelLabel.toUpperCase()}
                      </Text>
                      <View style={[styles.statusBadge, {borderColor: badgeColor}]}>
                        <Text style={[styles.statusBadgeText, {color: badgeColor}]}>
                          {badgeText}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[styles.roundQuestionSnippet, {color: colors.textPrimary}]}
                      numberOfLines={2}>
                      {round.question}
                    </Text>
                  </View>

                  <Icon
                    name={isLocked ? 'lock-closed' : 'chevron-forward'}
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* PRACTICE VIEW: Answering active round */}
      {activeView === 'practice' && selectedRound && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {paddingBottom: Math.max(insets.bottom, 20) + 40},
          ]}
          showsVerticalScrollIndicator={false}>
          {/* Question Card */}
          <View
            style={[
              styles.questionCard,
              {backgroundColor: colors.bgCard, borderColor: colors.border},
            ]}>
            <View style={styles.questionLevelBadge}>
              <Text style={[styles.questionLevelText, {color: colors.primaryStart}]}>
                ROUND {selectedRound.roundNumber} • {selectedRound.levelLabel.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.questionMainText, {color: colors.textPrimary}]}>
              {selectedRound.question}
            </Text>
            {selectedRound.contextHint && (
              <View
                style={[
                  styles.hintBox,
                  {backgroundColor: isDark ? '#1C1917' : '#FEF3C7', borderColor: '#F59E0B'},
                ]}>
                <Icon name="bulb-outline" size={16} color="#D97706" />
                <Text style={[styles.hintText, {color: isDark ? '#FDE68A' : '#92400E'}]}>
                  {selectedRound.contextHint}
                </Text>
              </View>
            )}

            {/* Play Question TTS Button */}
            <TouchableOpacity
              onPress={handlePlayQuestion}
              disabled={isPlayingAudio}
              style={[
                styles.playQuestionBtn,
                {
                  backgroundColor: isPlayingAudio
                    ? colors.accentSoft
                    : hasPlayedQuestion
                    ? colors.accentSoft
                    : colors.bgDark,
                  borderColor: isPlayingAudio ? colors.primaryStart : colors.border,
                },
              ]}
              activeOpacity={0.8}>
              {isPlayingAudio ? (
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                  <ActivityIndicator size="small" color={colors.primaryStart} />
                  <Text style={[styles.playQuestionText, {color: colors.primaryStart}]}>
                    Speaking question aloud...
                  </Text>
                </View>
              ) : (
                <>
                  <Icon
                    name={hasPlayedQuestion ? 'volume-high' : 'volume-medium-outline'}
                    size={18}
                    color={colors.primaryStart}
                  />
                  <Text style={[styles.playQuestionText, {color: colors.primaryStart}]}>
                    {hasPlayedQuestion ? 'Listen Again (Audio Ready)' : 'Play Question (TTS Required)'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Recording Interface */}
          <View
            style={[
              styles.recordingCard,
              {backgroundColor: colors.bgCard, borderColor: colors.border},
            ]}>
            <Text style={[styles.recHeaderTitle, {color: colors.textPrimary}]}>
              Voice Response
            </Text>
            <Text style={[styles.recHeaderSub, {color: colors.textSecondary}]}>
              Limit: 120s • Structured answers score higher
            </Text>

            {/* Timer Display */}
            <View style={styles.timerWrap}>
              <Text
                style={[
                  styles.timerText,
                  {color: isRecording ? '#EF4444' : colors.textPrimary},
                ]}>
                {formatSeconds(recordingSeconds)} / 02:00
              </Text>
            </View>

            {/* Prompt Toast Alert */}
            {audioPromptToast && (
              <View style={styles.toastBox}>
                <Icon name="information-circle" size={16} color="#3B82F6" />
                <Text style={styles.toastText}>{audioPromptToast}</Text>
              </View>
            )}

            {/* Recording Button */}
            <View style={styles.recordButtonWrap}>
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{scale: pulseAnim}],
                    borderColor: isRecording ? '#EF4444' : 'transparent',
                  },
                ]}
              />
              <TouchableOpacity
                onPress={isRecording ? handleStopRecording : handleStartRecording}
                style={[
                  styles.recordButton,
                  {
                    backgroundColor: isRecording ? '#EF4444' : colors.primaryStart,
                  },
                ]}
                activeOpacity={0.85}>
                <Icon
                  name={isRecording ? 'stop' : 'mic'}
                  size={32}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>

            <Text style={[styles.recordHint, {color: colors.textMuted}]}>
              {isRecording
                ? 'Tap stop when you finish your answer.'
                : hasPlayedQuestion
                ? 'Tap microphone to start speaking.'
                : 'Play the question above to unlock recording.'}
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Review & Edit Transcript Modal (Rule IC-27) */}
      <Modal visible={showTranscriptModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              {backgroundColor: colors.bgCard, borderColor: colors.border},
            ]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, {color: colors.textPrimary}]}>
                  Review & Edit Answer
                </Text>
                <Text style={[styles.modalSubtitle, {color: colors.textSecondary}]}>
                  Verify your response before AI scoring
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowTranscriptModal(false)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Icon name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {isTranscribing ? (
              <View
                style={[
                  styles.transcribingBanner,
                  {
                    backgroundColor: isDark ? '#2E1E3B' : '#F5F3FF',
                    borderColor: '#A855F7',
                  },
                ]}>
                <ActivityIndicator size="small" color="#A855F7" />
                <View style={{marginLeft: 10, flex: 1}}>
                  <Text style={[styles.transcribingTitle, {color: isDark ? '#F3E8FF' : '#581C87'}]}>
                    Transcribing your speech with AI...
                  </Text>
                  <Text style={[styles.transcribingSub, {color: isDark ? '#D8B4FE' : '#6B21A8'}]}>
                    Listening to your recording and extracting your exact spoken words.
                  </Text>
                </View>
              </View>
            ) : null}

            {!isTranscribing && !transcriptText.trim() && recordedBase64 ? (
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                  paddingHorizontal: 4,
                }}>
                <Text style={{fontSize: 12, color: colors.textMuted}}>
                  Speech didn't appear?
                </Text>
                <TouchableOpacity
                  onPress={handleRetryTranscription}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: RADIUS.sm,
                    backgroundColor: isDark ? '#2E1E3B' : '#F5F3FF',
                    borderWidth: 1,
                    borderColor: '#A855F7',
                  }}
                  activeOpacity={0.75}>
                  <Icon name="refresh" size={14} color="#A855F7" />
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#A855F7',
                      fontFamily: FONTS.semiBold,
                    }}>
                    Retry AI Transcribe
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <TextInput
              style={[
                styles.transcriptInput,
                {
                  color: colors.textPrimary,
                  backgroundColor: isDark ? '#18181B' : '#F4F4F5',
                  borderColor: colors.border,
                  opacity: isTranscribing ? 0.6 : 1,
                },
              ]}
              editable={!isTranscribing}
              multiline
              value={transcriptText}
              onChangeText={setTranscriptText}
              placeholder={isTranscribing ? 'Transcribing in progress...' : 'Your answer transcript...'}
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.reRecordBtn, {borderColor: colors.border}]}
                onPress={() => {
                  setShowTranscriptModal(false);
                  setRecordingSeconds(0);
                }}>
                <Text style={[styles.reRecordText, {color: colors.textSecondary}]}>
                  Re-record
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  {
                    backgroundColor:
                      isTranscribing || isSubmittingAttempt || !transcriptText.trim()
                        ? '#6B7280'
                        : colors.primaryStart,
                  },
                ]}
                onPress={handleSubmitAttempt}
                disabled={isTranscribing || isSubmittingAttempt || !transcriptText.trim()}
                activeOpacity={0.85}>
                {isSubmittingAttempt ? (
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>Analyzing with AI...</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>
                      {isTranscribing ? 'Transcribing...' : 'Submit & Get Graded'}
                    </Text>
                    {!isTranscribing && <Icon name="checkmark" size={16} color="#FFFFFF" />}
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Drop-off Survey Modal (Rule IC-33) */}
      <Modal visible={showDropOffModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.surveyModalContent,
              {backgroundColor: colors.bgCard, borderColor: colors.border},
            ]}>
            <Icon name="chatbubble-ellipses-outline" size={32} color={colors.primaryStart} />
            <Text style={[styles.surveyTitle, {color: colors.textPrimary}]}>
              Leaving before attempting Round 1?
            </Text>
            <Text style={[styles.surveySub, {color: colors.textSecondary}]}>
              The first question takes only 60 seconds and builds crucial confidence for {journey.jobRole}.
            </Text>

            <View style={styles.surveyBtnCol}>
              <TouchableOpacity
                style={[styles.surveyPrimaryBtn, {backgroundColor: colors.primaryStart}]}
                onPress={() => {
                  setShowDropOffModal(false);
                  if (journey.rounds[0]) handleRoundPress(journey.rounds[0]);
                }}
                activeOpacity={0.85}>
                <Text style={styles.surveyPrimaryText}>Try Question 1 Now</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.surveySecondaryBtn}
                onPress={() => {
                  setShowDropOffModal(false);
                  setAutoResumeSuppressed(true);
                  navigation.goBack();
                }}>
                <Text style={[styles.surveySecondaryText, {color: colors.textMuted}]}>
                  Exit Anyway
                </Text>
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
  loadingContainer: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  loadingText: {marginTop: 12, fontSize: 14, fontFamily: FONTS.medium},
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
  closePracticeBtn: {
    padding: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  scroll: {flex: 1},
  scrollContent: {padding: SPACING.md},
  journeyStatusCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusTitle: {color: '#FFFFFF', fontSize: 16, fontFamily: FONTS.bold},
  statusSub: {color: '#9CA3AF', fontSize: 12, fontFamily: FONTS.regular, marginTop: 2},
  skipWarmupBtn: {
    backgroundColor: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  skipWarmupText: {color: '#60A5FA', fontSize: 11, fontFamily: FONTS.semiBold},
  timelineContainer: {marginTop: SPACING.xs},
  roundRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  roundNumCol: {alignItems: 'center', width: 44, marginRight: 10},
  roundNumCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundNumText: {fontSize: 12, fontFamily: FONTS.bold},
  timelineConnector: {width: 2, height: 16, marginTop: 4},
  roundInfoCol: {flex: 1},
  roundLevelRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2},
  levelLabel: {fontSize: 10, fontFamily: FONTS.bold, letterSpacing: 0.5},
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  statusBadgeText: {fontSize: 10, fontFamily: FONTS.medium},
  roundQuestionSnippet: {fontSize: 13, fontFamily: FONTS.regular, lineHeight: 18},
  questionCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  questionLevelBadge: {marginBottom: SPACING.xs},
  questionLevelText: {fontSize: 11, fontFamily: FONTS.bold, letterSpacing: 0.5},
  questionMainText: {fontSize: 16, fontFamily: FONTS.semiBold, lineHeight: 23, marginBottom: SPACING.md},
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 8,
    marginBottom: SPACING.md,
  },
  hintText: {flex: 1, fontSize: 12, fontFamily: FONTS.regular, lineHeight: 17},
  playQuestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 6,
  },
  playQuestionText: {fontSize: 13, fontFamily: FONTS.semiBold},
  recordingCard: {
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  recHeaderTitle: {fontSize: 16, fontFamily: FONTS.bold},
  recHeaderSub: {fontSize: 12, fontFamily: FONTS.regular, marginTop: 2},
  timerWrap: {marginVertical: SPACING.lg},
  timerText: {fontSize: 28, fontFamily: FONTS.bold, letterSpacing: 1},
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 6,
    marginBottom: SPACING.md,
  },
  toastText: {fontSize: 12, fontFamily: FONTS.medium, color: '#1E40AF'},
  recordButtonWrap: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  pulseRing: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  recordHint: {fontSize: 12, fontFamily: FONTS.regular, textAlign: 'center'},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  modalTitle: {fontSize: 17, fontFamily: FONTS.bold},
  modalSubtitle: {fontSize: 12, fontFamily: FONTS.regular, marginTop: 2},
  transcribingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  transcribingTitle: {fontSize: 13, fontFamily: FONTS.bold},
  transcribingSub: {fontSize: 11, fontFamily: FONTS.regular, marginTop: 2, lineHeight: 15},
  transcriptInput: {
    minHeight: 140,
    maxHeight: 220,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: FONTS.regular,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SPACING.lg,
  },
  reRecordBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  reRecordText: {fontSize: 13, fontFamily: FONTS.medium},
  submitBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  submitBtnText: {color: '#FFFFFF', fontSize: 13, fontFamily: FONTS.semiBold},
  surveyModalContent: {
    margin: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  surveyTitle: {fontSize: 17, fontFamily: FONTS.bold, marginTop: SPACING.md, textAlign: 'center'},
  surveySub: {fontSize: 13, fontFamily: FONTS.regular, textAlign: 'center', marginTop: 6, lineHeight: 18},
  surveyBtnCol: {width: '100%', marginTop: SPACING.lg, gap: 10},
  surveyPrimaryBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  surveyPrimaryText: {color: '#FFFFFF', fontSize: 14, fontFamily: FONTS.semiBold},
  surveySecondaryBtn: {alignItems: 'center', paddingVertical: 8},
  surveySecondaryText: {fontSize: 13, fontFamily: FONTS.regular},
});

export default InterviewSessionScreen;
