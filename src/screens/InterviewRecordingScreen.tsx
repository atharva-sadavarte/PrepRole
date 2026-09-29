import React, {useState, useRef, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../context/ThemeContext';
import {SPACING, RADIUS, FONTS} from '../lib/theme';
import Icon from '../components/Icon';
import {ExperienceLevel, InterviewMode} from '../types/interview';
import {
  requestAudioPermission,
  requestCameraPermission,
  startNativeAudioRecording,
  stopNativeAudioRecording,
  cancelNativeAudioRecording,
  playNativeAudio,
  stopNativeAudio,
  captureNativeVideo,
  MediaRecordingResult,
} from '../services/interviewMediaService';
import {analyzeInterviewIntro} from '../services/interviewAiService';
import {saveInterviewSession} from '../services/interviewSessionService';
import type {Session} from '@supabase/supabase-js';

const {width} = Dimensions.get('window');

const MAX_DURATION_SECONDS = 90; // 1 min 30 sec
const MIN_DURATION_SECONDS = 60; // 1 min

const ANALYZING_STEPS = [
  'Listening to your pitch pacing & tone...',
  'Evaluating structure & Present-Past-Future flow...',
  'Checking relevance against target role criteria...',
  'Detecting filler words and delivery cadence...',
  'Drafting personalized Gold Standard rewrite script...',
];

interface InterviewRecordingScreenProps {
  route: {
    params: {
      experienceLevel: ExperienceLevel;
      recordingMode: InterviewMode;
      targetRole: string;
    };
  };
  navigation: any;
  session: Session;
}

export const InterviewRecordingScreen: React.FC<InterviewRecordingScreenProps> = ({
  route,
  navigation,
  session,
}) => {
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();

  const {experienceLevel, recordingMode, targetRole} = route.params;

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordedResult, setRecordedResult] = useState<MediaRecordingResult | null>(null);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Analysis loading states
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);

  // Timer Ref
  const timerIntervalRef = useRef<any>(null);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnims = useRef([
    new Animated.Value(0.3),
    new Animated.Value(0.7),
    new Animated.Value(0.4),
    new Animated.Value(0.9),
    new Animated.Value(0.5),
    new Animated.Value(0.8),
    new Animated.Value(0.3),
  ]).current;

  // Pulse animation for recording ring
  useEffect(() => {
    let loop: Animated.CompositeAnimation;
    if (isRecording) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.22,
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

      // Sound bar jitter animation
      const barInterval = setInterval(() => {
        waveAnims.forEach(anim => {
          Animated.timing(anim, {
            toValue: Math.random() * 0.7 + 0.3,
            duration: 180,
            useNativeDriver: true,
          }).start();
        });
      }, 200);

      return () => {
        loop?.stop();
        clearInterval(barInterval);
      };
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim, waveAnims]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      stopNativeAudio();
      cancelNativeAudioRecording();
    };
  }, []);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Coaching cue prompt based on elapsed time
  const getCoachingCue = () => {
    if (!isRecording && !recordedResult) {
      return 'Press the button below when you are ready to begin.';
    }
    if (secondsElapsed < 20) {
      return 'Step 1: Introduce yourself, your background/degree, and core specialty.';
    }
    if (secondsElapsed < 60) {
      return experienceLevel === 'fresher'
        ? 'Step 2: Highlight your best project, tech stack used, and the problem solved.'
        : 'Step 2: Highlight a key career win with quantifiable metrics & business impact.';
    }
    if (secondsElapsed < 80) {
      return 'Step 3: State why this role excites you and the unique value you will deliver.';
    }
    return 'Wrapping up: Deliver a confident closing sentence before 1:30!';
  };

  // Auto-stop at 90s
  const handleStopRecording = useCallback(async () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRecording(false);

    try {
      const result = await stopNativeAudioRecording(secondsElapsed);
      setRecordedResult(result);
    } catch (err: any) {
      Alert.alert('Recording Error', err?.message || 'Failed to finish recording');
    }
  }, [secondsElapsed]);

  // Start audio recording
  const handleStartAudioRecording = async () => {
    const hasPermission = await requestAudioPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'Microphone permission is needed to record your interview introduction.',
      );
      return;
    }

    setRecordedResult(null);
    setSecondsElapsed(0);

    const started = await startNativeAudioRecording();
    if (!started) {
      Alert.alert('Error', 'Could not initialize audio recorder.');
      return;
    }

    setIsRecording(true);

    timerIntervalRef.current = setInterval(() => {
      setSecondsElapsed(prev => {
        const next = prev + 1;
        if (next >= MAX_DURATION_SECONDS) {
          handleStopRecording();
          return MAX_DURATION_SECONDS;
        }
        return next;
      });
    }, 1000);
  };

  // Launch video recording
  const handleLaunchVideoRecording = async () => {
    const hasCamera = await requestCameraPermission();
    const hasAudio = await requestAudioPermission();

    if (!hasCamera || !hasAudio) {
      Alert.alert(
        'Permissions Needed',
        'Camera and microphone permissions are required for video interview practice.',
      );
      return;
    }

    try {
      const result = await captureNativeVideo(75);
      setRecordedResult(result);
      setSecondsElapsed(result.durationSeconds || 75);
    } catch (err: any) {
      if (err.message !== 'USER_CANCELLED') {
        Alert.alert('Video Capture', err?.message || 'Could not record video.');
      }
    }
  };

  // Audio preview playback toggle
  const handleTogglePlayback = async () => {
    if (!recordedResult?.uri) return;

    if (isPlayingAudio) {
      await stopNativeAudio();
      setIsPlayingAudio(false);
    } else {
      setIsPlayingAudio(true);
      const ok = await playNativeAudio(recordedResult.uri);
      if (!ok) {
        setIsPlayingAudio(false);
      }
    }
  };

  // Retake
  const handleRetake = () => {
    stopNativeAudio();
    setIsPlayingAudio(false);
    setRecordedResult(null);
    setSecondsElapsed(0);
  };

  // Submit to AI
  const handleSubmitAnalysis = async () => {
    if (!recordedResult && secondsElapsed < 10) {
      Alert.alert(
        'Pitch Too Short',
        'Please record at least 15 seconds to receive an accurate AI evaluation.',
      );
      return;
    }

    setAnalyzing(true);
    setAnalysisStep(0);

    const stepInterval = setInterval(() => {
      setAnalysisStep(prev => (prev + 1) % ANALYZING_STEPS.length);
    }, 2200);

    try {
      const duration = recordedResult?.durationSeconds || secondsElapsed || 60;
      const mediaBase64 = recordedResult?.base64;
      const mimeType = recordedResult?.mimeType || (recordingMode === 'video' ? 'video/mp4' : 'audio/mp4');

      const analysis = await analyzeInterviewIntro({
        experienceLevel,
        recordingMode,
        targetRole,
        durationSeconds: duration,
        mediaBase64,
        mimeType,
      });

      clearInterval(stepInterval);

      // Save to Supabase and local cache
      const userId = session?.user?.id || 'guest-user';
      const savedSession = await saveInterviewSession(userId, analysis);

      setAnalyzing(false);

      // Navigate to results
      navigation.replace('InterviewResult', {
        analysis: savedSession,
      });
    } catch (error: any) {
      clearInterval(stepInterval);
      setAnalyzing(false);
      Alert.alert(
        'Analysis Failed',
        error?.message || 'An error occurred while evaluating your pitch. Please try again.',
      );
    }
  };

  // Progress percentage calculation
  const progressRatio = Math.min(1, secondsElapsed / MAX_DURATION_SECONDS);

  // Status color for progress
  const getTimerColor = () => {
    if (secondsElapsed < MIN_DURATION_SECONDS) return '#D9822B'; // Orange/amber (under 60s)
    if (secondsElapsed <= 85) return '#5B8266'; // Green (optimal 60-85s)
    return '#C25953'; // Red (approaching 90s)
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={[colors.bgDark, colors.gradientMiddle, colors.gradientEnd]}
        style={styles.gradient}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              paddingTop: Math.max(insets.top, 14) + SPACING.xs,
              backgroundColor: colors.bgDark,
              borderBottomColor: colors.border,
            },
          ]}>
          <TouchableOpacity
            onPress={() => {
              if (isRecording) {
                Alert.alert(
                  'Cancel Recording?',
                  'Are you sure you want to discard your current recording?',
                  [
                    {text: 'Keep Recording', style: 'cancel'},
                    {
                      text: 'Discard',
                      style: 'destructive',
                      onPress: () => {
                        cancelNativeAudioRecording();
                        navigation.goBack();
                      },
                    },
                  ],
                );
              } else {
                navigation.goBack();
              }
            }}
            style={[
              styles.backButton,
              {
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
              },
            ]}
            activeOpacity={0.7}>
            <Icon name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={[styles.headerRole, {color: colors.textPrimary}]}>
              {targetRole}
            </Text>
            <View style={styles.headerBadgeRow}>
              <View
                style={[
                  styles.miniBadge,
                  {backgroundColor: colors.accentSoft},
                ]}>
                <Text style={[styles.miniBadgeText, {color: colors.primaryStart}]}>
                  {experienceLevel === 'fresher' ? 'Fresher' : 'Experienced'}
                </Text>
              </View>
              <View
                style={[
                  styles.miniBadge,
                  {backgroundColor: colors.bgCardLight},
                ]}>
                <Text style={[styles.miniBadgeText, {color: colors.textSecondary}]}>
                  {recordingMode === 'video' ? 'Video Pitch' : 'Audio Pitch'}
                </Text>
              </View>
            </View>
          </View>

          <View style={{width: 40}} />
        </View>

        {/* Studio Center Body */}
        <View style={styles.body}>
          {/* Digital Timer & Target Indicator */}
          <View style={styles.timerContainer}>
            <Text style={[styles.timerValue, {color: getTimerColor()}]}>
              {formatTime(secondsElapsed)}
            </Text>
            <Text style={[styles.timerLimit, {color: colors.textMuted}]}>
              / 01:30 MAX
            </Text>
          </View>

          {/* Progress Bar with 60s milestone */}
          <View style={[styles.progressTrack, {backgroundColor: colors.bgCardLight}]}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${progressRatio * 100}%`,
                  backgroundColor: getTimerColor(),
                },
              ]}
            />
            {/* 60s Indicator Tick */}
            <View
              style={[
                styles.targetTick,
                {left: `${(MIN_DURATION_SECONDS / MAX_DURATION_SECONDS) * 100}%`},
              ]}>
              <View style={[styles.tickLine, {backgroundColor: colors.primaryStart}]} />
              <Text style={[styles.tickLabel, {color: colors.primaryStart}]}>
                1:00 min
              </Text>
            </View>
          </View>

          {/* Prompt Cue Box */}
          <View
            style={[
              styles.cueBox,
              {
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
              },
            ]}>
            <View style={styles.cueHeader}>
              <Icon
                name="bulb-outline"
                size={16}
                color={colors.primaryStart}
                style={{marginRight: 6}}
              />
              <Text style={[styles.cueLabel, {color: colors.primaryStart}]}>
                LIVE COACH CUE
              </Text>
            </View>
            <Text style={[styles.cueText, {color: colors.textPrimary}]}>
              {getCoachingCue()}
            </Text>
          </View>

          {/* Central Recording Interaction Area */}
          <View style={styles.centerInteraction}>
            {recordingMode === 'video' ? (
              // VIDEO MODE UI
              <View style={styles.videoModeContainer}>
                {recordedResult ? (
                  // Video Recorded State
                  <View
                    style={[
                      styles.videoPreviewCard,
                      {
                        backgroundColor: colors.bgCard,
                        borderColor: colors.border,
                      },
                    ]}>
                    <View
                      style={[
                        styles.videoIconCircle,
                        {backgroundColor: 'rgba(91, 130, 102, 0.15)'},
                      ]}>
                      <Icon name="videocam" size={36} color="#5B8266" />
                    </View>
                    <Text
                      style={[styles.previewReadyTitle, {color: colors.textPrimary}]}>
                      Video Intro Captured!
                    </Text>
                    <Text
                      style={[styles.previewReadyDesc, {color: colors.textSecondary}]}>
                      Duration: {recordedResult.durationSeconds}s
                      {recordedResult.durationSeconds >= MIN_DURATION_SECONDS
                        ? ' • Optimal timing achieved'
                        : ' • Under 1 min'}
                    </Text>
                  </View>
                ) : (
                  // Ready to Record Video State
                  <View style={styles.videoReadyBox}>
                    <TouchableOpacity
                      style={styles.cameraLaunchBtn}
                      activeOpacity={0.85}
                      onPress={handleLaunchVideoRecording}>
                      <LinearGradient
                        colors={[colors.primaryStart, colors.primaryEnd]}
                        style={styles.cameraLaunchGradient}
                        start={{x: 0, y: 0}}
                        end={{x: 1, y: 1}}>
                        <Icon name="videocam" size={42} color="#FFFFFF" />
                        <Text style={styles.cameraLaunchText}>
                          Open Camera & Record (Max 90s)
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <Text
                      style={[
                        styles.cameraHint,
                        {color: colors.textSecondary},
                      ]}>
                      Position your phone at eye level. Speak naturally and finish within 1:30.
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              // AUDIO ONLY MODE UI
              <View style={styles.audioModeContainer}>
                {/* Audio Waveform visualization */}
                {isRecording && (
                  <View style={styles.waveformContainer}>
                    {waveAnims.map((anim, idx) => (
                      <Animated.View
                        key={idx}
                        style={[
                          styles.waveBar,
                          {
                            backgroundColor: colors.primaryStart,
                            transform: [{scaleY: anim}],
                          },
                        ]}
                      />
                    ))}
                  </View>
                )}

                {/* Big Microphone Recording Button */}
                <View style={styles.micButtonWrap}>
                  {isRecording && (
                    <Animated.View
                      style={[
                        styles.pulseRing,
                        {
                          borderColor: colors.primaryStart,
                          transform: [{scale: pulseAnim}],
                        },
                      ]}
                    />
                  )}

                  <TouchableOpacity
                    style={[
                      styles.micMainBtn,
                      {
                        backgroundColor: isRecording
                          ? '#C25953'
                          : colors.primaryStart,
                      },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (isRecording) {
                        handleStopRecording();
                      } else {
                        handleStartAudioRecording();
                      }
                    }}>
                    <Icon
                      name={isRecording ? 'stop' : 'mic'}
                      size={36}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>
                </View>

                <Text
                  style={[
                    styles.micStatusText,
                    {color: isRecording ? colors.primaryStart : colors.textPrimary},
                  ]}>
                  {isRecording
                    ? 'Recording Intro... Tap to Finish'
                    : recordedResult
                    ? 'Recording Completed'
                    : 'Tap Mic to Start (1m to 1:30s)'}
                </Text>

                {/* Audio Playback Review Button if recorded */}
                {recordedResult && !isRecording && (
                  <TouchableOpacity
                    style={[
                      styles.playbackBtn,
                      {
                        backgroundColor: colors.bgCard,
                        borderColor: colors.border,
                      },
                    ]}
                    activeOpacity={0.7}
                    onPress={handleTogglePlayback}>
                    <Icon
                      name={isPlayingAudio ? 'pause' : 'play'}
                      size={18}
                      color={colors.primaryStart}
                      style={{marginRight: 6}}
                    />
                    <Text
                      style={[styles.playbackBtnText, {color: colors.textPrimary}]}>
                      {isPlayingAudio ? 'Pause Playback' : 'Listen to Recording'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Footer Actions */}
        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: colors.bgDark,
              borderTopColor: colors.border,
            },
          ]}>
          {recordedResult ? (
            <View style={styles.reviewActionsRow}>
              {/* Retake Button */}
              <TouchableOpacity
                style={[
                  styles.retakeBtn,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                  },
                ]}
                activeOpacity={0.8}
                onPress={handleRetake}>
                <Icon
                  name="refresh"
                  size={18}
                  color={colors.textSecondary}
                  style={{marginRight: 6}}
                />
                <Text style={[styles.retakeText, {color: colors.textPrimary}]}>
                  Retake Drill
                </Text>
              </TouchableOpacity>

              {/* Submit & Analyze Button */}
              <TouchableOpacity
                style={styles.submitBtn}
                activeOpacity={0.85}
                onPress={handleSubmitAnalysis}>
                <LinearGradient
                  colors={[colors.primaryStart, colors.primaryEnd]}
                  style={styles.submitBtnGradient}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}>
                  <Icon
                    name="sparkles"
                    size={18}
                    color="#FFFFFF"
                    style={{marginRight: 8}}
                  />
                  <Text style={styles.submitBtnText}>
                    Analyze My Pitch
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : isRecording ? (
            <TouchableOpacity
              style={[styles.stopBottomBtn, {backgroundColor: '#C25953'}]}
              activeOpacity={0.85}
              onPress={handleStopRecording}>
              <Icon
                name="stop-circle"
                size={22}
                color="#FFFFFF"
                style={{marginRight: 8}}
              />
              <Text style={styles.stopBottomBtnText}>
                Finish & Review Pitch
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.hintFooter}>
              <Text
                style={[styles.hintFooterText, {color: colors.textSecondary}]}>
                Target duration is 60s–90s. Recording stops automatically at 1:30.
              </Text>
            </View>
          )}
        </View>

        {/* Analyzing Modal Overlay */}
        {analyzing && (
          <View style={styles.analyzingOverlay}>
            <View
              style={[
                styles.analyzingCard,
                {
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                },
              ]}>
              <View style={styles.analyzingSpinnerWrap}>
                <ActivityIndicator size="large" color={colors.primaryStart} />
              </View>

              <Text
                style={[styles.analyzingTitle, {color: colors.textPrimary}]}>
                Evaluating Your Pitch
              </Text>

              <Text
                style={[styles.analyzingStepText, {color: colors.textSecondary}]}>
                {ANALYZING_STEPS[analysisStep]}
              </Text>

              <View
                style={[
                  styles.analyzingProgressTrack,
                  {backgroundColor: colors.bgCardLight},
                ]}>
                <View
                  style={[
                    styles.analyzingProgressBar,
                    {
                      width: `${((analysisStep + 1) / ANALYZING_STEPS.length) * 100}%`,
                      backgroundColor: colors.primaryStart,
                    },
                  ]}
                />
              </View>
            </View>
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
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerInfo: {
    alignItems: 'center',
  },
  headerRole: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    marginBottom: 2,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  miniBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  miniBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  body: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    alignItems: 'center',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  timerValue: {
    fontFamily: FONTS.bold,
    fontSize: 44,
    letterSpacing: 1,
  },
  timerLimit: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    marginLeft: 6,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'visible',
    position: 'relative',
    marginBottom: SPACING.lg,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  targetTick: {
    position: 'absolute',
    top: -2,
    alignItems: 'center',
  },
  tickLine: {
    width: 2,
    height: 12,
    borderRadius: 1,
  },
  tickLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    marginTop: 2,
  },
  cueBox: {
    width: '100%',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm + 2,
    marginBottom: SPACING.lg,
  },
  cueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cueLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  cueText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  centerInteraction: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoModeContainer: {
    width: '100%',
    alignItems: 'center',
  },
  videoReadyBox: {
    width: '100%',
    alignItems: 'center',
  },
  cameraLaunchBtn: {
    width: '100%',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  cameraLaunchGradient: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraLaunchText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 12,
  },
  cameraHint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
  },
  videoPreviewCard: {
    width: '100%',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  videoIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  previewReadyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    marginBottom: 4,
  },
  previewReadyDesc: {
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
  audioModeContainer: {
    alignItems: 'center',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    marginBottom: SPACING.md,
  },
  waveBar: {
    width: 6,
    height: 40,
    borderRadius: 3,
  },
  micButtonWrap: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
  },
  micMainBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  micStatusText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    marginBottom: 12,
  },
  playbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginTop: 8,
  },
  playbackBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  footer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  reviewActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  retakeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
  },
  submitBtn: {
    flex: 2,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  submitBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  submitBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  stopBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: RADIUS.md,
  },
  stopBottomBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  hintFooter: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  hintFooterText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
  },
  analyzingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(18, 17, 16, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  analyzingCard: {
    width: '100%',
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: 'center',
  },
  analyzingSpinnerWrap: {
    marginBottom: 16,
  },
  analyzingTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    marginBottom: 8,
  },
  analyzingStepText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    textAlign: 'center',
    minHeight: 38,
    marginBottom: 16,
  },
  analyzingProgressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  analyzingProgressBar: {
    height: '100%',
    borderRadius: 3,
  },
});

export default InterviewRecordingScreen;
