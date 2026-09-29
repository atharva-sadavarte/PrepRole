import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Share,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../context/ThemeContext';
import {SPACING, RADIUS, FONTS} from '../lib/theme';
import {ScoreGauge} from '../components/ScoreGauge';
import Icon from '../components/Icon';
import {InterviewSessionRecord, InterviewImprovement} from '../types/interview';

const {width} = Dimensions.get('window');

interface InterviewResultScreenProps {
  route: {
    params: {
      analysis: InterviewSessionRecord;
    };
  };
  navigation: any;
}

export const InterviewResultScreen: React.FC<InterviewResultScreenProps> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();

  const {analysis} = route.params;

  const [activeTab, setActiveTab] = useState<
    'recommendations' | 'rewrite' | 'strengths' | 'metrics'
  >('recommendations');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I just scored ${analysis.overall_score}/100 on my ${analysis.target_role} interview intro pitch drill on PrepRole! Master the 60-90s 'Tell Me About Yourself' question with AI coaching.`,
      });
    } catch (e) {
      console.warn(e);
    }
  };

  const handleCopyRewrite = () => {
    Share.share({
      title: 'My Gold Standard Intro Script',
      message: analysis.ideal_script_rewrite,
    });
  };

  const handlePracticeAgain = () => {
    navigation.navigate('InterviewSetup');
  };

  const improvements = analysis.improvements || [];
  const filteredImprovements =
    priorityFilter === 'all'
      ? improvements
      : improvements.filter(imp => imp.priority === priorityFilter);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#C25953';
      case 'medium':
        return '#D9822B';
      case 'low':
        return '#5B8266';
      default:
        return colors.primaryStart;
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m > 0 ? `${m}m ` : ''}${s}s`;
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
            onPress={() => navigation.navigate('DashboardMain')}
            style={[
              styles.headerBtn,
              {
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
              },
            ]}
            activeOpacity={0.7}>
            <Icon name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
              Pitch Assessment
            </Text>
            <Text style={[styles.headerSubtitle, {color: colors.textSecondary}]}>
              {analysis.target_role}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleShare}
            style={[
              styles.headerBtn,
              {
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
              },
            ]}
            activeOpacity={0.7}>
            <Icon name="share-outline" size={19} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {paddingBottom: Math.max(insets.bottom, 20) + 80},
          ]}
          showsVerticalScrollIndicator={false}>
          <Animated.View style={{opacity: fadeAnim}}>
            {/* Target Role & Profile Pill Bar */}
            <View style={styles.roleBar}>
              <View style={styles.roleBadgeRow}>
                <View
                  style={[
                    styles.profilePill,
                    {backgroundColor: colors.accentSoft},
                  ]}>
                  <Icon
                    name={
                      analysis.experience_level === 'fresher'
                        ? 'school-outline'
                        : 'briefcase-outline'
                    }
                    size={13}
                    color={colors.primaryStart}
                    style={{marginRight: 4}}
                  />
                  <Text
                    style={[
                      styles.profilePillText,
                      {color: colors.primaryStart},
                    ]}>
                    {analysis.experience_level === 'fresher'
                      ? 'Fresher Pitch'
                      : 'Experienced Pitch'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.profilePill,
                    {backgroundColor: colors.bgCardLight},
                  ]}>
                  <Icon
                    name={
                      analysis.recording_mode === 'video'
                        ? 'videocam-outline'
                        : 'mic-outline'
                    }
                    size={13}
                    color={colors.textSecondary}
                    style={{marginRight: 4}}
                  />
                  <Text
                    style={[
                      styles.profilePillText,
                      {color: colors.textSecondary},
                    ]}>
                    {analysis.recording_mode === 'video'
                      ? 'Video & Audio'
                      : 'Audio Only'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.profilePill,
                    {
                      backgroundColor:
                        analysis.duration_seconds >= 60 &&
                        analysis.duration_seconds <= 90
                          ? 'rgba(91, 130, 102, 0.15)'
                          : 'rgba(217, 130, 43, 0.15)',
                    },
                  ]}>
                  <Icon
                    name="time-outline"
                    size={13}
                    color={
                      analysis.duration_seconds >= 60 &&
                      analysis.duration_seconds <= 90
                        ? '#5B8266'
                        : '#D9822B'
                    }
                    style={{marginRight: 4}}
                  />
                  <Text
                    style={[
                      styles.profilePillText,
                      {
                        color:
                          analysis.duration_seconds >= 60 &&
                          analysis.duration_seconds <= 90
                            ? '#5B8266'
                            : '#D9822B',
                      },
                    ]}>
                    {formatDuration(analysis.duration_seconds)}
                    {analysis.duration_seconds >= 60 &&
                    analysis.duration_seconds <= 90
                      ? ' (Sweet Spot)'
                      : ''}
                  </Text>
                </View>
              </View>
            </View>

            {/* Score Hero Card */}
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                },
              ]}>
              <ScoreGauge
                score={analysis.overall_score}
                tier={
                  analysis.overall_score >= 85
                    ? 'Strong Match'
                    : analysis.overall_score >= 70
                    ? 'Competitive'
                    : analysis.overall_score >= 50
                    ? 'Developing'
                    : 'Needs Work'
                }
              />

              {/* Tier badge subtitle */}
              <View
                style={[
                  styles.tierTag,
                  {
                    backgroundColor:
                      analysis.overall_score >= 85
                        ? 'rgba(91, 130, 102, 0.18)'
                        : analysis.overall_score >= 70
                        ? colors.accentSoft
                        : 'rgba(194, 89, 83, 0.15)',
                  },
                ]}>
                <Text
                  style={[
                    styles.tierTagText,
                    {
                      color:
                        analysis.overall_score >= 85
                          ? '#5B8266'
                          : analysis.overall_score >= 70
                          ? colors.primaryStart
                          : '#C25953',
                    },
                  ]}>
                  {analysis.score_tier}
                </Text>
              </View>

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
                  },
                ]}>
                <View style={styles.summaryHeader}>
                  <Icon
                    name="sparkles"
                    size={14}
                    color={colors.primaryStart}
                    style={{marginRight: 6}}
                  />
                  <Text
                    style={[
                      styles.summaryLabel,
                      {color: colors.primaryStart},
                    ]}>
                    COACH EVALUATION
                  </Text>
                </View>
                <Text
                  style={[styles.summaryText, {color: colors.textPrimary}]}>
                  {analysis.summary}
                </Text>
              </View>
            </View>

            {/* 4 Pillars Breakdown Grid */}
            <View style={styles.pillarsGrid}>
              <View
                style={[
                  styles.pillarCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                  },
                ]}>
                <View style={styles.pillarTop}>
                  <Icon name="layers-outline" size={16} color={colors.primaryStart} />
                  <Text
                    style={[styles.pillarScore, {color: colors.textPrimary}]}>
                    {analysis.breakdown.structure}
                  </Text>
                </View>
                <Text
                  style={[styles.pillarTitle, {color: colors.textPrimary}]}>
                  Structure
                </Text>
                <Text
                  style={[styles.pillarDesc, {color: colors.textSecondary}]}>
                  Present $\rightarrow$ Past $\rightarrow$ Future flow
                </Text>
              </View>

              <View
                style={[
                  styles.pillarCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                  },
                ]}>
                <View style={styles.pillarTop}>
                  <Icon
                    name="checkmark-circle-outline"
                    size={16}
                    color="#5B8266"
                  />
                  <Text
                    style={[styles.pillarScore, {color: colors.textPrimary}]}>
                    {analysis.breakdown.relevance}
                  </Text>
                </View>
                <Text
                  style={[styles.pillarTitle, {color: colors.textPrimary}]}>
                  Relevance
                </Text>
                <Text
                  style={[styles.pillarDesc, {color: colors.textSecondary}]}>
                  {analysis.experience_level === 'fresher'
                    ? 'Project depth & passion'
                    : 'Impact metrics & scope'}
                </Text>
              </View>

              <View
                style={[
                  styles.pillarCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                  },
                ]}>
                <View style={styles.pillarTop}>
                  <Icon
                    name="volume-high-outline"
                    size={16}
                    color="#D9822B"
                  />
                  <Text
                    style={[styles.pillarScore, {color: colors.textPrimary}]}>
                    {analysis.breakdown.delivery}
                  </Text>
                </View>
                <Text
                  style={[styles.pillarTitle, {color: colors.textPrimary}]}>
                  Delivery
                </Text>
                <Text
                  style={[styles.pillarDesc, {color: colors.textSecondary}]}>
                  Cadence, tone & confidence
                </Text>
              </View>

              <View
                style={[
                  styles.pillarCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                  },
                ]}>
                <View style={styles.pillarTop}>
                  <Icon name="timer-outline" size={16} color={colors.accent} />
                  <Text
                    style={[styles.pillarScore, {color: colors.textPrimary}]}>
                    {analysis.breakdown.timing}
                  </Text>
                </View>
                <Text
                  style={[styles.pillarTitle, {color: colors.textPrimary}]}>
                  Timing
                </Text>
                <Text
                  style={[styles.pillarDesc, {color: colors.textSecondary}]}>
                  60s–90s sweet spot
                </Text>
              </View>
            </View>

            {/* Interactive Tabs Header */}
            <View
              style={[
                styles.tabsContainer,
                {borderBottomColor: colors.border},
              ]}>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  activeTab === 'recommendations' && {
                    borderBottomColor: colors.primaryStart,
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => setActiveTab('recommendations')}>
                <Text
                  style={[
                    styles.tabButtonText,
                    {
                      color:
                        activeTab === 'recommendations'
                          ? colors.primaryStart
                          : colors.textSecondary,
                    },
                  ]}>
                  Coaching ({improvements.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabButton,
                  activeTab === 'rewrite' && {
                    borderBottomColor: colors.primaryStart,
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => setActiveTab('rewrite')}>
                <Text
                  style={[
                    styles.tabButtonText,
                    {
                      color:
                        activeTab === 'rewrite'
                          ? colors.primaryStart
                          : colors.textSecondary,
                    },
                  ]}>
                  Gold Script
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabButton,
                  activeTab === 'strengths' && {
                    borderBottomColor: colors.primaryStart,
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => setActiveTab('strengths')}>
                <Text
                  style={[
                    styles.tabButtonText,
                    {
                      color:
                        activeTab === 'strengths'
                          ? colors.primaryStart
                          : colors.textSecondary,
                    },
                  ]}>
                  Strengths
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabButton,
                  activeTab === 'metrics' && {
                    borderBottomColor: colors.primaryStart,
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => setActiveTab('metrics')}>
                <Text
                  style={[
                    styles.tabButtonText,
                    {
                      color:
                        activeTab === 'metrics'
                          ? colors.primaryStart
                          : colors.textSecondary,
                    },
                  ]}>
                  Speech
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB 1: RECOMMENDATIONS */}
            {activeTab === 'recommendations' && (
              <View style={styles.tabContentSection}>
                {/* Priority filters */}
                <View style={styles.filterPillsRow}>
                  {(['all', 'high', 'medium', 'low'] as const).map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.filterPill,
                        {
                          backgroundColor:
                            priorityFilter === p
                              ? colors.primaryStart
                              : colors.bgCard,
                          borderColor:
                            priorityFilter === p
                              ? colors.primaryStart
                              : colors.border,
                        },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => setPriorityFilter(p)}>
                      <Text
                        style={[
                          styles.filterPillText,
                          {
                            color:
                              priorityFilter === p
                                ? '#FFFFFF'
                                : colors.textSecondary,
                          },
                        ]}>
                        {p === 'all'
                          ? 'All Priorities'
                          : `${p.toUpperCase()} Priority`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Recommendations list */}
                {filteredImprovements.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text
                      style={[styles.emptyText, {color: colors.textSecondary}]}>
                      No recommendations in this filter.
                    </Text>
                  </View>
                ) : (
                  filteredImprovements.map((imp, idx) => (
                    <View
                      key={imp.id || idx}
                      style={[
                        styles.recCard,
                        {
                          backgroundColor: colors.bgCard,
                          borderColor: colors.border,
                        },
                      ]}>
                      <View style={styles.recHeader}>
                        <View style={styles.recBadges}>
                          <View
                            style={[
                              styles.categoryBadge,
                              {backgroundColor: colors.bgCardLight},
                            ]}>
                            <Text
                              style={[
                                styles.categoryBadgeText,
                                {color: colors.textPrimary},
                              ]}>
                              {imp.category}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.priorityBadge,
                              {
                                backgroundColor: `${getPriorityColor(
                                  imp.priority,
                                )}20`,
                              },
                            ]}>
                            <Text
                              style={[
                                styles.priorityBadgeText,
                                {color: getPriorityColor(imp.priority)},
                              ]}>
                              {imp.priority.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <Text
                        style={[styles.recTitle, {color: colors.textPrimary}]}>
                        {imp.title}
                      </Text>

                      <Text
                        style={[
                          styles.recCritique,
                          {color: colors.textSecondary},
                        ]}>
                        {imp.critique}
                      </Text>

                      <View
                        style={[
                          styles.recAdviceBox,
                          {
                            backgroundColor: colors.bgDark,
                            borderColor: colors.border,
                          },
                        ]}>
                        <View style={styles.adviceHeader}>
                          <Icon
                            name="bulb"
                            size={14}
                            color={colors.primaryStart}
                            style={{marginRight: 6}}
                          />
                          <Text
                            style={[
                              styles.adviceHeaderText,
                              {color: colors.primaryStart},
                            ]}>
                            ACTIONABLE TIP
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.adviceBodyText,
                            {color: colors.textPrimary},
                          ]}>
                          {imp.recommendation}
                        </Text>
                      </View>

                      {imp.exampleScript && (
                        <View
                          style={[
                            styles.exampleScriptBox,
                            {
                              backgroundColor: 'rgba(91, 130, 102, 0.1)',
                              borderColor: 'rgba(91, 130, 102, 0.3)',
                            },
                          ]}>
                          <Text
                            style={[
                              styles.exampleScriptLabel,
                              {color: '#5B8266'},
                            ]}>
                            TRY SAYING THIS:
                          </Text>
                          <Text
                            style={[
                              styles.exampleScriptText,
                              {color: colors.textPrimary},
                            ]}>
                            "{imp.exampleScript}"
                          </Text>
                        </View>
                      )}
                    </View>
                  ))
                )}
              </View>
            )}

            {/* TAB 2: GOLD STANDARD REWRITE */}
            {activeTab === 'rewrite' && (
              <View style={styles.tabContentSection}>
                <View
                  style={[
                    styles.scriptCard,
                    {
                      backgroundColor: colors.bgCard,
                      borderColor: colors.border,
                    },
                  ]}>
                  <View style={styles.scriptHeader}>
                    <View style={styles.scriptBadge}>
                      <Icon
                        name="trophy-outline"
                        size={15}
                        color={colors.primaryStart}
                      />
                      <Text
                        style={[
                          styles.scriptBadgeText,
                          {color: colors.primaryStart},
                        ]}>
                        AI GOLD STANDARD INTRO
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={handleCopyRewrite}
                      style={[
                        styles.copyBtn,
                        {
                          backgroundColor: colors.bgCardLight,
                          borderColor: colors.border,
                        },
                      ]}
                      activeOpacity={0.7}>
                      <Icon
                        name="share-social-outline"
                        size={14}
                        color={colors.textPrimary}
                        style={{marginRight: 4}}
                      />
                      <Text
                        style={[
                          styles.copyBtnText,
                          {color: colors.textPrimary},
                        ]}>
                        Share
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text
                    style={[styles.scriptText, {color: colors.textPrimary}]}>
                    {analysis.ideal_script_rewrite}
                  </Text>

                  <View
                    style={[
                      styles.scriptFooterTip,
                      {borderTopColor: colors.border},
                    ]}>
                    <Icon
                      name="mic-outline"
                      size={16}
                      color={colors.primaryStart}
                      style={{marginRight: 6}}
                    />
                    <Text
                      style={[
                        styles.scriptFooterText,
                        {color: colors.textSecondary},
                      ]}>
                      Read this script aloud at ~130 WPM. It is designed to take roughly 70–80 seconds.
                    </Text>
                  </View>
                </View>

                {/* Key Takeaways */}
                {analysis.key_takeaways && analysis.key_takeaways.length > 0 && (
                  <View
                    style={[
                      styles.takeawaysCard,
                      {
                        backgroundColor: colors.bgCard,
                        borderColor: colors.border,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.takeawaysTitle,
                        {color: colors.textPrimary},
                      ]}>
                      Key Takeaways for Your Next Drill
                    </Text>
                    {analysis.key_takeaways.map((takeaway, idx) => (
                      <View key={idx} style={styles.takeawayItem}>
                        <View
                          style={[
                            styles.takeawayDot,
                            {backgroundColor: colors.primaryStart},
                          ]}
                        />
                        <Text
                          style={[
                            styles.takeawayText,
                            {color: colors.textSecondary},
                          ]}>
                          {takeaway}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* TAB 3: STRENGTHS */}
            {activeTab === 'strengths' && (
              <View style={styles.tabContentSection}>
                {analysis.strengths && analysis.strengths.length > 0 ? (
                  analysis.strengths.map((str, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.strengthCard,
                        {
                          backgroundColor: colors.bgCard,
                          borderColor: colors.border,
                        },
                      ]}>
                      <View
                        style={[
                          styles.strengthIconWrap,
                          {backgroundColor: 'rgba(91, 130, 102, 0.15)'},
                        ]}>
                        <Icon name="checkmark" size={16} color="#5B8266" />
                      </View>
                      <Text
                        style={[
                          styles.strengthText,
                          {color: colors.textPrimary},
                        ]}>
                        {str}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyCard}>
                    <Text
                      style={[styles.emptyText, {color: colors.textSecondary}]}>
                      Solid foundations established in this pitch drill.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* TAB 4: SPEECH METRICS */}
            {activeTab === 'metrics' && (
              <View style={styles.tabContentSection}>
                {/* Cadence card */}
                <View
                  style={[
                    styles.metricCard,
                    {
                      backgroundColor: colors.bgCard,
                      borderColor: colors.border,
                    },
                  ]}>
                  <View style={styles.metricCardHeader}>
                    <Icon
                      name="speedometer-outline"
                      size={20}
                      color={colors.primaryStart}
                    />
                    <Text
                      style={[
                        styles.metricCardTitle,
                        {color: colors.textPrimary},
                      ]}>
                      Speaking Cadence & Pacing
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.metricValueLarge,
                      {color: colors.primaryStart},
                    ]}>
                    ~{analysis.pacing_wpm_estimate || 135} WPM
                  </Text>
                  <Text
                    style={[
                      styles.metricDesc,
                      {color: colors.textSecondary},
                    ]}>
                    Ideal interview speaking speed is between 120 and 150 words per minute. Pacing yourself prevents verbal rush and conveys composure.
                  </Text>
                </View>

                {/* Filler Words */}
                <View
                  style={[
                    styles.metricCard,
                    {
                      backgroundColor: colors.bgCard,
                      borderColor: colors.border,
                    },
                  ]}>
                  <View style={styles.metricCardHeader}>
                    <Icon
                      name="chatbubble-ellipses-outline"
                      size={20}
                      color="#D9822B"
                    />
                    <Text
                      style={[
                        styles.metricCardTitle,
                        {color: colors.textPrimary},
                      ]}>
                      Detected Filler Words
                    </Text>
                  </View>

                  {analysis.filler_words && analysis.filler_words.length > 0 ? (
                    <View style={styles.fillerChipsRow}>
                      {analysis.filler_words.map((fw, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.fillerChip,
                            {
                              backgroundColor: colors.bgDark,
                              borderColor: colors.border,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.fillerChipWord,
                              {color: colors.textPrimary},
                            ]}>
                            "{fw.word}"
                          </Text>
                          <View
                            style={[
                              styles.fillerCountBadge,
                              {backgroundColor: 'rgba(217, 130, 43, 0.2)'},
                            ]}>
                            <Text
                              style={[
                                styles.fillerCountText,
                                {color: '#D9822B'},
                              ]}>
                              {fw.count}x
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text
                      style={[
                        styles.noFillerText,
                        {color: colors.textSecondary},
                      ]}>
                      No noticeable filler words detected! Outstanding clarity.
                    </Text>
                  )}
                </View>
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {/* Footer Fixed Action */}
        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: colors.bgDark,
              borderTopColor: colors.border,
            },
          ]}>
          <TouchableOpacity
            style={styles.practiceBtn}
            activeOpacity={0.85}
            onPress={handlePracticeAgain}>
            <LinearGradient
              colors={[colors.primaryStart, colors.primaryEnd]}
              style={styles.practiceBtnGradient}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}>
              <Icon
                name="refresh-circle"
                size={22}
                color="#FFFFFF"
                style={{marginRight: 8}}
              />
              <Text style={styles.practiceBtnText}>
                Practice Another Intro
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 17,
  },
  headerSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  roleBar: {
    marginBottom: SPACING.sm,
  },
  roleBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  profilePillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
  heroCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  tierTag: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginTop: 6,
    marginBottom: 12,
  },
  tierTagText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryBox: {
    width: '100%',
    padding: SPACING.sm + 4,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  summaryText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  pillarsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.md,
  },
  pillarCard: {
    flex: 1,
    minWidth: '47%',
    padding: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  pillarTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pillarScore: {
    fontFamily: FONTS.bold,
    fontSize: 16,
  },
  pillarTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    marginBottom: 2,
  },
  pillarDesc: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    lineHeight: 14,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: SPACING.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  tabContentSection: {
    gap: SPACING.sm,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: SPACING.xs,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  filterPillText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
  },
  recCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  recHeader: {
    marginBottom: 6,
  },
  recBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  categoryBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  priorityBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
  },
  recTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    marginBottom: 4,
  },
  recCritique: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  recAdviceBox: {
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    marginBottom: 8,
  },
  adviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  adviceHeaderText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  adviceBodyText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  exampleScriptBox: {
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  exampleScriptLabel: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  exampleScriptText: {
    fontFamily: FONTS.italic,
    fontSize: 12,
    lineHeight: 16,
  },
  scriptCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  scriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scriptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scriptBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  copyBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
  scriptText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 14,
  },
  scriptFooterTip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  scriptFooterText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 11,
    lineHeight: 15,
  },
  takeawaysCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },
  takeawaysTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    marginBottom: 10,
  },
  takeawayItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  takeawayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: 8,
  },
  takeawayText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  strengthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm + 4,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  strengthIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  strengthText: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 13,
    lineHeight: 17,
  },
  metricCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  metricCardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
  },
  metricValueLarge: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    marginBottom: 6,
  },
  metricDesc: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  fillerChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  fillerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 6,
  },
  fillerChipWord: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  fillerCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
  },
  fillerCountText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
  },
  noFillerText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    marginTop: 4,
  },
  emptyCard: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
  },
  footer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  practiceBtn: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  practiceBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  practiceBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});

export default InterviewResultScreen;
