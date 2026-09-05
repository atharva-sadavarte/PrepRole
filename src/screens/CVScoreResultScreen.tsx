/* eslint-disable react-native/no-inline-styles */
import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Share,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {COLORS, RADIUS, SPACING} from '../lib/theme';
import {ScoreGauge} from '../components/ScoreGauge';
import {RecommendationCard} from '../components/RecommendationCard';
import {ResumeAnalysisRecord, PriorityLevel} from '../types/resume';

interface CVScoreResultScreenProps {
  route: {
    params: {
      analysis: ResumeAnalysisRecord;
    };
  };
  navigation: any;
}

export const CVScoreResultScreen: React.FC<CVScoreResultScreenProps> = ({
  route,
  navigation,
}) => {
  const {analysis} = route.params;
  const [activeTab, setActiveTab] = useState<'recommendations' | 'skills' | 'strengths'>(
    'recommendations',
  );
  const [priorityFilter, setPriorityFilter] = useState<'all' | PriorityLevel>('all');
  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>({});

  const toggleComplete = (id: string) => {
    setCompletedMap(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `My CV scored ${analysis.overall_score}/100 for the role of ${analysis.target_role} on PrepRole! 🚀`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const improvements = analysis.improvements || [];
  const filteredImprovements =
    priorityFilter === 'all'
      ? improvements
      : improvements.filter(imp => imp.priority === priorityFilter);

  const completedCount = Object.values(completedMap).filter(Boolean).length;
  const totalCount = improvements.length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[COLORS.bgDark, '#0F1329', '#141833']}
        style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Dashboard')}
            style={styles.backButton}>
            <Text style={styles.backText}>← Dashboard</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>CV Score Report</Text>
          <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
            <Text style={styles.shareText}>Share ↗</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          {/* Target Role Banner */}
          <View style={styles.roleBanner}>
            <Text style={styles.roleLabel}>ANALYSIS FOR TARGET ROLE</Text>
            <Text style={styles.roleTitle}>{analysis.target_role}</Text>
            {analysis.file_name && (
              <Text style={styles.fileSub}>Source: {analysis.file_name}</Text>
            )}
          </View>

          {/* Score Hero */}
          <View style={styles.heroCard}>
            <ScoreGauge
              score={analysis.overall_score}
              tier={analysis.score_tier}
            />

            {/* Executive Summary */}
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>AI Executive Summary</Text>
              <Text style={styles.summaryText}>{analysis.summary}</Text>
            </View>

            {/* 4 Score Breakdown Pillars */}
            <View style={styles.breakdownGrid}>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownIcon}>🎯</Text>
                <Text style={styles.breakdownScore}>
                  {analysis.breakdown?.relevance || 0}%
                </Text>
                <Text style={styles.breakdownLabel}>Role Alignment</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownIcon}>🛠️</Text>
                <Text style={styles.breakdownScore}>
                  {analysis.breakdown?.skills || 0}%
                </Text>
                <Text style={styles.breakdownLabel}>Skills Match</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownIcon}>📈</Text>
                <Text style={styles.breakdownScore}>
                  {analysis.breakdown?.impact || 0}%
                </Text>
                <Text style={styles.breakdownLabel}>Metrics & Impact</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownIcon}>📄</Text>
                <Text style={styles.breakdownScore}>
                  {analysis.breakdown?.ats || 0}%
                </Text>
                <Text style={styles.breakdownLabel}>ATS Readability</Text>
              </View>
            </View>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'recommendations' && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab('recommendations')}>
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'recommendations' && styles.tabTextActive,
                ]}>
                💡 Recommendations ({improvements.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'skills' && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab('skills')}>
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'skills' && styles.tabTextActive,
                ]}>
                ⚡ Skills Matrix
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'strengths' && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab('strengths')}>
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'strengths' && styles.tabTextActive,
                ]}>
                🌟 Strengths
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: RECOMMENDATIONS */}
          {activeTab === 'recommendations' && (
            <View style={styles.sectionContainer}>
              {/* Progress counter */}
              <View style={styles.progressRow}>
                <Text style={styles.progressText}>
                  Action Plan: {completedCount} of {totalCount} completed
                </Text>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
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
                {(['all', 'high', 'medium', 'low'] as const).map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.filterChip,
                      priorityFilter === p && styles.filterChipActive,
                    ]}
                    onPress={() => setPriorityFilter(p)}>
                    <Text
                      style={[
                        styles.filterChipText,
                        priorityFilter === p && styles.filterChipTextActive,
                      ]}>
                      {p === 'all'
                        ? 'All'
                        : p === 'high'
                        ? '🔴 Critical'
                        : p === 'medium'
                        ? '🟡 Medium'
                        : '🟢 Polish'}
                    </Text>
                  </TouchableOpacity>
                ))}
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
              <View style={styles.skillsCard}>
                <View style={styles.skillsHeader}>
                  <Text style={styles.skillsIcon}>✅</Text>
                  <Text style={styles.skillsTitle}>
                    Matched Skills ({analysis.skills_matched?.length || 0})
                  </Text>
                </View>
                <Text style={styles.skillsSubtitle}>
                  Identified in your CV matching requirements for this role:
                </Text>
                <View style={styles.skillsChips}>
                  {analysis.skills_matched?.length ? (
                    analysis.skills_matched.map((skill, idx) => (
                      <View key={idx} style={styles.skillMatchedBadge}>
                        <Text style={styles.skillMatchedText}>{skill} ✓</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No matched skills detected.</Text>
                  )}
                </View>
              </View>

              {/* Missing / Recommended Skills */}
              <View style={styles.skillsCard}>
                <View style={styles.skillsHeader}>
                  <Text style={styles.skillsIcon}>⚠️</Text>
                  <Text style={[styles.skillsTitle, styles.skillsTitleWarning]}>
                    Recommended Skills to Add ({analysis.skills_missing?.length || 0})
                  </Text>
                </View>
                <Text style={styles.skillsSubtitle}>
                  Frequently requested for {analysis.target_role} but missing from your CV:
                </Text>
                <View style={styles.skillsChips}>
                  {analysis.skills_missing?.length ? (
                    analysis.skills_missing.map((skill, idx) => (
                      <View key={idx} style={styles.skillMissingBadge}>
                        <Text style={styles.skillMissingText}>+ {skill}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No missing skills detected. Great job!</Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* TAB 3: STRENGTHS */}
          {activeTab === 'strengths' && (
            <View style={styles.sectionContainer}>
              <View style={styles.strengthsCard}>
                <Text style={styles.strengthsTitle}>What Stood Out in Your CV</Text>
                <Text style={styles.strengthsSubtitle}>
                  Keep these strong elements intact when updating your resume:
                </Text>
                {analysis.strengths?.map((str, idx) => (
                  <View key={idx} style={styles.strengthItem}>
                    <Text style={styles.strengthBullet}>✦</Text>
                    <Text style={styles.strengthText}>{str}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('CVUpload')}
              style={styles.rescanButton}
              activeOpacity={0.8}>
              <Text style={styles.rescanButtonText}>🔄 Re-Analyze Updated CV</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                // Future Mock Interview link
                navigation.navigate('Dashboard');
              }}
              activeOpacity={0.85}
              style={styles.interviewButtonWrapper}>
              <LinearGradient
                colors={[COLORS.primaryStart, COLORS.primaryEnd]}
                style={styles.interviewButton}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}>
                <Text style={styles.interviewButtonText}>
                  🎯 Ready for Interview Practice →
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  },
  backText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  shareButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: COLORS.bgCardLight,
    borderRadius: RADIUS.full,
  },
  shareText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl * 2,
  },
  roleBanner: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  roleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
    letterSpacing: 1,
    marginBottom: 4,
  },
  roleTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  fileSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  heroCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  summaryBox: {
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    width: '100%',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primaryStart,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primaryStart,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 19,
  },
  breakdownGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
  },
  breakdownItem: {
    flex: 1,
    backgroundColor: COLORS.bgCardLight,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  breakdownIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  breakdownScore: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  breakdownLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCardLight,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  tabButtonActive: {
    backgroundColor: COLORS.bgCard,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  tabTextActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  sectionContainer: {
    marginBottom: SPACING.lg,
  },
  progressRow: {
    marginBottom: SPACING.md,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: COLORS.bgCardLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.success,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: SPACING.md,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgCardLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: 'rgba(108, 99, 255, 0.25)',
    borderColor: COLORS.primaryStart,
  },
  filterChipText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  skillsCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  skillsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  skillsIcon: {
    fontSize: 16,
  },
  skillsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.success,
  },
  skillsTitleWarning: {
    color: '#FFAB00',
  },
  skillsSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  skillsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillMatchedBadge: {
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.3)',
  },
  skillMatchedText: {
    color: COLORS.success,
    fontSize: 12,
    fontWeight: '600',
  },
  skillMissingBadge: {
    backgroundColor: 'rgba(255, 171, 0, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 171, 0, 0.3)',
  },
  skillMissingText: {
    color: '#FFAB00',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  strengthsCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  strengthsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  strengthsSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  strengthItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  strengthBullet: {
    color: COLORS.accent,
    fontSize: 14,
    marginRight: 8,
    marginTop: 2,
  },
  strengthText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 19,
  },
  bottomActions: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  rescanButton: {
    backgroundColor: COLORS.bgCardLight,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rescanButtonText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  interviewButtonWrapper: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  interviewButton: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  interviewButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default CVScoreResultScreen;
