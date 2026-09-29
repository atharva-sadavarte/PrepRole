import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  Animated,
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
  InterviewJourney,
  SocraticMessage,
  AVAILABLE_LANGUAGES,
} from '../../types/interviewCoach';
import {
  validateJobRoleSocratic,
  generate10RoundQuestions,
  saveInterviewJourney,
  getUserJourneys,
  getLatestInProgressJourney,
  findExistingJourneyForRole,
  deleteInterviewJourney,
  setAutoResumeSuppressed,
} from '../../services/interviewCoachService';

interface InterviewCoachScreenV2Props {
  navigation: any;
  route?: any;
  session: Session;
}

export const InterviewCoachScreenV2: React.FC<InterviewCoachScreenV2Props> = ({
  navigation,
  route,
  session,
}) => {
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();
  const userId = session?.user?.id || 'guest_user';

  // Language state
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  // Socratic chat state
  const [inputText, setInputText] = useState('');
  const [chatMessages, setChatMessages] = useState<SocraticMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am your AI Interview Coach. What specific job role or specialization are you preparing to interview for?',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [confirmedRole, setConfirmedRole] = useState<{
    finalTitle: string;
    jobDescription: string;
    existingJourneyId?: string;
  } | null>(null);
  const [isGeneratingJourney, setIsGeneratingJourney] = useState(false);

  // Recent journeys state
  const [journeys, setJourneys] = useState<InterviewJourney[]>([]);
  const [activeTab, setActiveTab] = useState<'ongoing' | 'completed'>('ongoing');
  const [loadingJourneys, setLoadingJourneys] = useState(true);

  // Scroll ref
  const chatScrollRef = useRef<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // On Mount: Auto-resume check & load history
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();

    loadJourneysAndCheckResume();
  }, []);

  const loadJourneysAndCheckResume = async () => {
    setLoadingJourneys(true);
    const list = await getUserJourneys(userId);
    setJourneys(list);
    setLoadingJourneys(false);

    // Auto-resume check (Rule IC-2, IC-3)
    const shouldResume = route?.params?.resumeOngoingFromMenu ?? true;
    if (shouldResume) {
      const latest = await getLatestInProgressJourney(userId);
      if (latest) {
        navigation.navigate('InterviewSession', {
          journeyId: latest.id,
          jobRole: latest.jobRole,
        });
      }
    }
  };

  const handleLanguageChange = (code: string) => {
    // IC-12: Changing language resets chat if no user input
    if (chatMessages.length <= 1) {
      setSelectedLanguage(code);
    } else {
      Alert.alert(
        'Switch Language',
        'Changing the language will reset your current role chat. Do you wish to continue?',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Change & Reset',
            style: 'destructive',
            onPress: () => {
              setSelectedLanguage(code);
              setConfirmedRole(null);
              setChatMessages([
                {
                  id: `welcome-${Date.now()}`,
                  role: 'assistant',
                  content:
                    'Language updated! What job role are you targeting for your interview preparation?',
                  timestamp: new Date().toISOString(),
                },
              ]);
            },
          },
        ],
      );
    }
    setShowLanguageModal(false);
  };

  // Submit chat message to Socratic AI
  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || isAiTyping) return;

    const userMsg: SocraticMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const nextMessages = [...chatMessages, userMsg];
    setChatMessages(nextMessages);
    setInputText('');
    setIsAiTyping(true);

    setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({animated: true});
    }, 100);

    try {
      const result = await validateJobRoleSocratic(
        nextMessages,
        text,
        selectedLanguage,
        'India',
      );

      const aiMsg: SocraticMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: result.message,
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, aiMsg]);

      if (result.end && result.final_title) {
        // Check if journey already exists (Rule IC-8)
        const existing = await findExistingJourneyForRole(userId, result.final_title);
        setConfirmedRole({
          finalTitle: result.final_title,
          jobDescription:
            result.jobDescription ||
            `Comprehensive 10-round preparation for ${result.final_title}.`,
          existingJourneyId: existing?.id,
        });
      }
    } catch (e) {
      console.warn('Socratic role validation error:', e);
    } finally {
      setIsAiTyping(false);
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({animated: true});
      }, 100);
    }
  };

  // Start new 10-round journey
  const handleStartJourney = async () => {
    if (!confirmedRole) return;
    setIsGeneratingJourney(true);

    try {
      const rounds = await generate10RoundQuestions(
        confirmedRole.finalTitle,
        selectedLanguage,
        'India',
      );

      const newJourney: InterviewJourney = {
        id: `journey-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId,
        jobRole: confirmedRole.finalTitle,
        language: selectedLanguage,
        learnerCountry: 'India',
        status: 'inProgress',
        currentRoundNumber: 1,
        rounds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveInterviewJourney(newJourney);
      await loadJourneysAndCheckResume();

      setIsGeneratingJourney(false);
      navigation.navigate('InterviewSession', {
        journeyId: newJourney.id,
        jobRole: newJourney.jobRole,
        isFirstTimeJobRole: true,
      });
    } catch (err) {
      setIsGeneratingJourney(false);
      Alert.alert(
        'Generation Failed',
        'Could not generate interview questions at this time. Please try again.',
      );
    }
  };

  // Resume journey
  const handleResumeJourney = (journey: InterviewJourney) => {
    navigation.navigate('InterviewSession', {
      journeyId: journey.id,
      jobRole: journey.jobRole,
    });
  };

  // Delete journey with confirmation
  const handleDeleteJourney = (journeyId: string) => {
    Alert.alert(
      'Delete Journey',
      'Are you sure you want to delete this interview journey and its history?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteInterviewJourney(userId, journeyId);
            loadJourneysAndCheckResume();
          },
        },
      ],
    );
  };

  const ongoingJourneys = journeys.filter(j => j.status === 'inProgress');
  const completedJourneys = journeys.filter(j => j.status === 'completed');
  const displayedJourneys = activeTab === 'ongoing' ? ongoingJourneys : completedJourneys;

  const currentLangLabel =
    AVAILABLE_LANGUAGES.find(l => l.code === selectedLanguage)?.label || 'English (US)';

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
          onPress={() => {
            setAutoResumeSuppressed(true);
            navigation.goBack();
          }}
          style={[styles.backBtn, {backgroundColor: colors.bgCard, borderColor: colors.border}]}
          activeOpacity={0.7}>
          <Icon name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
            Interview Coach
          </Text>
          <Text style={[styles.headerSubtitle, {color: colors.textSecondary}]}>
            10-Round Progressive AI Mock Journey
          </Text>
        </View>

        {/* Language selector pill */}
        <TouchableOpacity
          onPress={() => setShowLanguageModal(true)}
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
          {paddingBottom: Math.max(insets.bottom, 20) + 40},
        ]}
        showsVerticalScrollIndicator={false}>
        <Animated.View style={{opacity: fadeAnim}}>
          {/* Hero Banner */}
          <LinearGradient
            colors={['#1E2E24', '#15201A', '#0F1612']}
            style={[styles.heroBanner, {borderColor: colors.border}]}>
            <View style={styles.bannerBadge}>
              <Icon name="sparkles" size={14} color="#6EE7B7" />
              <Text style={styles.bannerBadgeText}>10 Progressive Rounds (R1 to R10)</Text>
            </View>
            <Text style={[styles.bannerTitle, {color: colors.textPrimary}]}>
              Simulate Real High-Stakes Tech Interviews
            </Text>
            <Text style={[styles.bannerDesc, {color: colors.textSecondary}]}>
              Target any role. Progress from warm-ups to real executive interview trials with multi-attribute scoring and tailored model answers.
            </Text>
          </LinearGradient>

          {/* Socratic Role Finder Card */}
          <View
            style={[
              styles.card,
              {backgroundColor: colors.bgCard, borderColor: colors.border},
            ]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, {backgroundColor: colors.accentSoft}]}>
                <Icon name="chatbubble-ellipses" size={18} color={colors.primaryStart} />
              </View>
              <View style={{flex: 1, marginLeft: SPACING.sm}}>
                <Text style={[styles.cardTitle, {color: colors.textPrimary}]}>
                  Target Role Finder
                </Text>
                <Text style={[styles.cardSubtitle, {color: colors.textSecondary}]}>
                  Discuss your ideal position with AI to personalize questions
                </Text>
              </View>
            </View>

            {/* Chat conversation area */}
            <View
              style={[
                styles.chatArea,
                {backgroundColor: isDark ? '#141416' : '#F8FAFC', borderColor: colors.border},
              ]}>
              <ScrollView
                ref={chatScrollRef}
                style={styles.chatScroll}
                contentContainerStyle={styles.chatScrollContent}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}>
                {chatMessages.map(msg => (
                  <View
                    key={msg.id}
                    style={[
                      styles.chatBubble,
                      msg.role === 'user'
                        ? [styles.userBubble, {backgroundColor: colors.primaryStart}]
                        : [
                            styles.aiBubble,
                            {
                              backgroundColor: colors.bgCard,
                              borderColor: colors.border,
                            },
                          ],
                    ]}>
                    <Text
                      style={[
                        styles.chatBubbleText,
                        {
                          color:
                            msg.role === 'user' ? '#FFFFFF' : colors.textPrimary,
                        },
                      ]}>
                      {msg.content}
                    </Text>
                  </View>
                ))}

                {isAiTyping && (
                  <View
                    style={[
                      styles.aiBubble,
                      {
                        backgroundColor: colors.bgCard,
                        borderColor: colors.border,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      },
                    ]}>
                    <ActivityIndicator size="small" color={colors.primaryStart} />
                    <Text style={{color: colors.textSecondary, fontSize: 13}}>
                      AI Coach is analyzing...
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Chat Input Bar */}
              <View
                style={[
                  styles.chatInputBar,
                  {
                    backgroundColor: colors.bgCard,
                    borderTopColor: colors.border,
                  },
                ]}>
                <TextInput
                  style={[styles.chatInput, {color: colors.textPrimary}]}
                  placeholder="e.g. Senior Frontend Engineer, DevOps..."
                  placeholderTextColor={colors.textMuted}
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={handleSendMessage}
                  returnKeyType="send"
                />
                <TouchableOpacity
                  onPress={handleSendMessage}
                  disabled={!inputText.trim() || isAiTyping}
                  style={[
                    styles.sendBtn,
                    {
                      backgroundColor:
                        inputText.trim() && !isAiTyping
                          ? colors.primaryStart
                          : colors.border,
                    },
                  ]}
                  activeOpacity={0.8}>
                  <Icon name="arrow-up" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirmed Role Action Card */}
            {confirmedRole && (
              <View
                style={[
                  styles.confirmedBox,
                  {
                    backgroundColor: isDark ? '#1C2920' : '#ECFDF5',
                    borderColor: '#10B981',
                  },
                ]}>
                <View style={styles.confirmedHeader}>
                  <Icon name="checkmark-circle" size={22} color="#10B981" />
                  <View style={{flex: 1, marginLeft: SPACING.xs}}>
                    <Text style={[styles.confirmedTitle, {color: colors.textPrimary}]}>
                      {confirmedRole.finalTitle}
                    </Text>
                    <Text style={[styles.confirmedDesc, {color: colors.textSecondary}]}>
                      {confirmedRole.jobDescription}
                    </Text>
                  </View>
                </View>

                {confirmedRole.existingJourneyId ? (
                  <View style={styles.confirmedBtnRow}>
                    <TouchableOpacity
                      style={[styles.primaryActionBtn, {backgroundColor: colors.primaryStart}]}
                      onPress={() => {
                        const existing = journeys.find(
                          j => j.id === confirmedRole.existingJourneyId,
                        );
                        if (existing) handleResumeJourney(existing);
                      }}
                      activeOpacity={0.85}>
                      <Icon name="play" size={16} color="#FFFFFF" />
                      <Text style={styles.primaryActionBtnText}>Resume Journey</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.confirmedBtnRow}>
                    <TouchableOpacity
                      style={[styles.primaryActionBtn, {backgroundColor: colors.primaryStart}]}
                      onPress={handleStartJourney}
                      disabled={isGeneratingJourney}
                      activeOpacity={0.85}>
                      {isGeneratingJourney ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Icon name="sparkles" size={16} color="#FFFFFF" />
                          <Text style={styles.primaryActionBtnText}>
                            Generate & Start Journey
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.secondaryActionBtn, {borderColor: colors.border}]}
                      onPress={() => setConfirmedRole(null)}
                      activeOpacity={0.7}>
                      <Text style={[styles.secondaryActionBtnText, {color: colors.textSecondary}]}>
                        Enter Another Role
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Recent Journeys Section */}
          <View style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
                Recent Journeys
              </Text>
              <View style={[styles.tabBar, {backgroundColor: colors.bgCard, borderColor: colors.border}]}>
                <TouchableOpacity
                  style={[
                    styles.tabItem,
                    activeTab === 'ongoing' && {backgroundColor: colors.accentSoft},
                  ]}
                  onPress={() => setActiveTab('ongoing')}>
                  <Text
                    style={[
                      styles.tabItemText,
                      {
                        color:
                          activeTab === 'ongoing'
                            ? colors.primaryStart
                            : colors.textSecondary,
                      },
                    ]}>
                    Ongoing ({ongoingJourneys.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tabItem,
                    activeTab === 'completed' && {backgroundColor: colors.accentSoft},
                  ]}
                  onPress={() => setActiveTab('completed')}>
                  <Text
                    style={[
                      styles.tabItemText,
                      {
                        color:
                          activeTab === 'completed'
                            ? colors.primaryStart
                            : colors.textSecondary,
                      },
                    ]}>
                    Completed ({completedJourneys.length})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {loadingJourneys ? (
              <ActivityIndicator
                size="small"
                color={colors.primaryStart}
                style={{marginTop: 20}}
              />
            ) : displayedJourneys.length === 0 ? (
              <View
                style={[
                  styles.emptyStateCard,
                  {backgroundColor: colors.bgCard, borderColor: colors.border},
                ]}>
                <Icon name="briefcase-outline" size={32} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, {color: colors.textPrimary}]}>
                  No {activeTab} journeys found
                </Text>
                <Text style={[styles.emptySubtitle, {color: colors.textSecondary}]}>
                  {activeTab === 'ongoing'
                    ? 'Start by entering a target role above to begin round 1.'
                    : 'Complete all 10 rounds with a passing score to graduate a journey.'}
                </Text>
              </View>
            ) : (
              displayedJourneys.map(j => {
                const passedCount = j.rounds.filter(
                  r => r.status === 'completed' || r.status === 'skipped',
                ).length;
                const progressPct = Math.round((passedCount / 10) * 100);

                return (
                  <View
                    key={j.id}
                    style={[
                      styles.journeyCard,
                      {backgroundColor: colors.bgCard, borderColor: colors.border},
                    ]}>
                    <View style={styles.journeyCardTop}>
                      <View style={{flex: 1}}>
                        <Text style={[styles.journeyRole, {color: colors.textPrimary}]}>
                          {j.jobRole}
                        </Text>
                        <Text style={[styles.journeyMeta, {color: colors.textSecondary}]}>
                          Round {j.currentRoundNumber}/10 •{' '}
                          {j.rounds[j.currentRoundNumber - 1]?.levelLabel || 'Warm-up'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteJourney(j.id)}
                        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                        <Icon name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                    {/* Progress bar */}
                    <View
                      style={[
                        styles.progressBarBg,
                        {backgroundColor: isDark ? '#27272A' : '#E2E8F0'},
                      ]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${progressPct}%`,
                            backgroundColor: colors.primaryStart,
                          },
                        ]}
                      />
                    </View>

                    <View style={styles.journeyCardBottom}>
                      <Text style={[styles.progressText, {color: colors.textMuted}]}>
                        {passedCount} of 10 rounds completed ({progressPct}%)
                      </Text>
                      <TouchableOpacity
                        style={[styles.resumeBtn, {backgroundColor: colors.primaryStart}]}
                        onPress={() => handleResumeJourney(j)}
                        activeOpacity={0.8}>
                        <Text style={styles.resumeBtnText}>
                          {j.status === 'completed' ? 'Review' : 'Resume'}
                        </Text>
                        <Icon name="arrow-forward" size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal visible={showLanguageModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLanguageModal(false)}>
          <View
            style={[
              styles.langModalContent,
              {backgroundColor: colors.bgCard, borderColor: colors.border},
            ]}>
            <Text style={[styles.modalTitle, {color: colors.textPrimary}]}>
              Select Language
            </Text>
            <Text style={[styles.modalSub, {color: colors.textSecondary}]}>
              Questions, speech audio, and feedback will be generated in this language.
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
                onPress={() => handleLanguageChange(lang.code)}>
                <Text
                  style={[
                    styles.langItemText,
                    {
                      color:
                        selectedLanguage === lang.code
                          ? colors.primaryStart
                          : colors.textPrimary,
                      fontFamily:
                        selectedLanguage === lang.code ? FONTS.bold : FONTS.regular,
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
  container: {
    flex: 1,
  },
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
  headerTitleWrap: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 4,
  },
  langPillText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  heroBanner: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.xs,
  },
  bannerBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: '#6EE7B7',
  },
  bannerTitle: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    marginBottom: SPACING.xs,
  },
  bannerDesc: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    lineHeight: 19,
  },
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
  cardSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
  },
  chatArea: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  chatScroll: {
    maxHeight: 220,
  },
  chatScrollContent: {
    padding: SPACING.sm,
    gap: 8,
  },
  chatBubble: {
    maxWidth: '85%',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
  },
  chatBubbleText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    lineHeight: 18,
  },
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderTopWidth: 1,
    gap: 8,
  },
  chatInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.regular,
    paddingVertical: 6,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmedBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  confirmedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  confirmedTitle: {
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  confirmedDesc: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    marginTop: 2,
  },
  confirmedBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  primaryActionBtnText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  secondaryActionBtn: {
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  secondaryActionBtnText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
  },
  recentSection: {
    marginTop: SPACING.xs,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    padding: 3,
  },
  tabItem: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  tabItemText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
  },
  emptyStateCard: {
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    marginTop: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  journeyCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  journeyCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  journeyRole: {
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  journeyMeta: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    marginTop: 2,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  journeyCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  progressText: {
    fontSize: 11,
    fontFamily: FONTS.regular,
  },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  resumeBtnText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  langModalContent: {
    width: '100%',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold,
  },
  modalSub: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    marginVertical: 8,
  },
  langItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: 8,
  },
  langItemText: {
    fontSize: 14,
  },
});

export default InterviewCoachScreenV2;
