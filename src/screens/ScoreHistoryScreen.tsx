import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useTheme} from '../context/ThemeContext';
import {COLORS, RADIUS, SPACING, ICON_SIZES, FONTS} from '../lib/theme';
import {
  getUserAnalyses,
  deleteAnalysis,
  openResumeInViewer,
} from '../services/resumeService';
import {ResumeAnalysisRecord} from '../types/resume';
import Icon from '../components/Icon';
import type {Session} from '@supabase/supabase-js';

interface ScoreHistoryScreenProps {
  session: Session;
  navigation: any;
}

export const ScoreHistoryScreen: React.FC<ScoreHistoryScreenProps> = ({
  session,
  navigation,
}) => {
  const {colors, isDark} = useTheme();
  const [analyses, setAnalyses] = useState<ResumeAnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'high' | 'mid' | 'low'>('all');

  const filteredAnalyses = useMemo(() => {
    if (filter === 'high') return analyses.filter(a => a.overall_score >= 80);
    if (filter === 'mid')
      return analyses.filter(
        a => a.overall_score >= 65 && a.overall_score < 80,
      );
    if (filter === 'low') return analyses.filter(a => a.overall_score < 65);
    return analyses;
  }, [analyses, filter]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const data = await getUserAnalyses(session.user.id);
        setAnalyses(data);
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [session.user.id]);

  const handleDelete = (id: string, role: string) => {
    Alert.alert(
      'Delete Analysis',
      `Are you sure you want to remove the scan for "${role}"?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteAnalysis(id);
            if (success) {
              setAnalyses(prev => prev.filter(item => item.id !== id));
            }
          },
        },
      ],
    );
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderItem = ({item}: {item: ResumeAnalysisRecord}) => {
    const isHigh = item.overall_score >= 80;
    const isMid = item.overall_score >= 65;

    return (
      <TouchableOpacity
        style={[
          styles.historyCard,
          {
            backgroundColor: colors.bgCard,
            borderColor: colors.border,
            shadowColor: colors.cardShadow,
            elevation: isDark ? 2 : 4,
          },
        ]}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('CVScoreResult', {analysis: item})}>
        <View style={styles.cardTop}>
          <View style={styles.roleInfo}>
            <Text
              style={[styles.roleTitle, {color: colors.textPrimary}]}
              numberOfLines={1}>
              {item.target_role}
            </Text>
            <Text style={[styles.dateText, {color: colors.textSecondary}]}>
              {formatDate(item.created_at)}
            </Text>
          </View>
          <View
            style={[
              styles.scoreBadge,
              isHigh
                ? styles.scoreHigh
                : isMid
                ? styles.scoreMid
                : styles.scoreLow,
            ]}>
            <Text
              style={[
                styles.scoreText,
                isHigh
                  ? styles.textHigh
                  : isMid
                  ? styles.textMid
                  : styles.textLow,
              ]}>
              {item.overall_score}
            </Text>
          </View>
        </View>

        <Text
          style={[styles.summarySnippet, {color: colors.textSecondary}]}
          numberOfLines={2}>
          {item.summary}
        </Text>

        <View style={styles.cardBottom}>
          <View style={styles.statsRow}>
            <View style={styles.statTagRow}>
              <Icon
                name="navigate"
                size={ICON_SIZES.xs}
                color={colors.textMuted}
                style={{marginRight: 3}}
              />
              <Text style={[styles.statTag, {color: colors.textMuted}]}>
                {item.breakdown?.relevance || 0}%
              </Text>
            </View>
            <View style={styles.statTagRow}>
              <Icon
                name="construct"
                size={ICON_SIZES.xs}
                color={colors.textMuted}
                style={{marginRight: 3}}
              />
              <Text style={[styles.statTag, {color: colors.textMuted}]}>
                {item.breakdown?.skills || 0}%
              </Text>
            </View>
          </View>
          <View style={styles.cardActionsRow}>
            {item.file_url ? (
              <TouchableOpacity
                onPress={() => openResumeInViewer(item.file_url!)}
                style={styles.historyPdfBtn}>
                <Icon
                  name="eye-outline"
                  size={ICON_SIZES.sm}
                  color={colors.accent}
                />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => handleDelete(item.id, item.target_role)}
              style={styles.deleteBtn}>
              <Icon
                name="trash-outline"
                size={ICON_SIZES.md}
                color={colors.error}
              />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={[colors.bgDark, colors.gradientMiddle, colors.gradientEnd]}
        style={styles.gradient}>
        {/* Modern Warm Minimalist Header */}
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
                <Icon name="archive-outline" size={11} color={colors.accent} />
              </View>
              <Text style={[styles.headerBadgeText, {color: colors.textPrimary}]}>
                ANALYSIS ARCHIVE
              </Text>
              <View
                style={[
                  styles.countPill,
                  {backgroundColor: colors.accentSoft},
                ]}>
                <Text style={[styles.countPillText, {color: colors.accent}]}>
                  {analyses.length}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() =>
                navigation
                  .getParent()
                  ?.navigate('AnalyzeTab', {screen: 'CVUploadMain'})
              }
              style={[styles.newScanBtn, {backgroundColor: colors.primaryStart}]}>
              <Icon
                name="add"
                size={14}
                color="#FFFFFF"
                style={{marginRight: 2}}
              />
              <Text style={styles.newScanText}>New Scan</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
            Resume History
          </Text>
          <Text style={[styles.headerSubtitle, {color: colors.textSecondary}]}>
            Track ATS score trajectory and evaluate keyword performance over time.
          </Text>

          {/* Filter Chips */}
          {analyses.length > 0 && (
            <View style={styles.filterContainer}>
              {(
                [
                  {key: 'all', label: `All (${analyses.length})`},
                  {
                    key: 'high',
                    label: `High (${analyses.filter(a => a.overall_score >= 80).length})`,
                  },
                  {
                    key: 'mid',
                    label: `Mid (${analyses.filter(a => a.overall_score >= 65 && a.overall_score < 80).length})`,
                  },
                  {
                    key: 'low',
                    label: `Low (${analyses.filter(a => a.overall_score < 65).length})`,
                  },
                ] as const
              ).map(item => {
                const isActive = filter === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => setFilter(item.key)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isActive
                          ? colors.accentSoft
                          : colors.bgCardLight,
                        borderColor: isActive ? colors.accent : colors.border,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.filterChipText,
                        {
                          color: isActive
                            ? colors.accent
                            : colors.textSecondary,
                          fontWeight: isActive ? '700' : '500',
                        },
                      ]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={colors.primaryStart} />
          </View>
        ) : analyses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyIconContainer,
                {backgroundColor: colors.bgCardLight},
              ]}>
              <Icon
                name="document-text-outline"
                size={56}
                color={colors.textMuted}
              />
            </View>
            <Text style={[styles.emptyTitle, {color: colors.textPrimary}]}>
              No CV Scans Yet
            </Text>
            <Text
              style={[styles.emptySubtitle, {color: colors.textSecondary}]}>
              Scan your first resume against a target role to get an instant AI score and recommendations.
            </Text>
            <TouchableOpacity
              onPress={() =>
                navigation
                  .getParent()
                  ?.navigate('AnalyzeTab', {screen: 'CVUploadMain'})
              }
              style={[
                styles.emptyActionBtn,
                {backgroundColor: colors.primaryStart},
              ]}>
              <Icon
                name="cloud-upload-outline"
                size={ICON_SIZES.md}
                color="#FFFFFF"
                style={{marginRight: 8}}
              />
              <Text style={styles.emptyActionText}>Upload & Analyze CV</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredAnalyses}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
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
  countPill: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
  },
  countPillText: {
    fontFamily: FONTS.extraBold,
    fontSize: 9,
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
    marginBottom: SPACING.sm,
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: SPACING.xs,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  filterChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
  newScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  newScanText: {
    fontFamily: FONTS.bold,
    color: '#fff',
    fontSize: 11,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  historyCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  roleInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  roleTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  dateText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  scoreBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreHigh: {
    backgroundColor: 'rgba(91, 130, 102, 0.15)',
    borderWidth: 1.5,
    borderColor: '#5B8266',
  },
  scoreMid: {
    backgroundColor: 'rgba(217, 130, 43, 0.15)',
    borderWidth: 1.5,
    borderColor: '#D9822B',
  },
  scoreLow: {
    backgroundColor: 'rgba(194, 89, 83, 0.15)',
    borderWidth: 1.5,
    borderColor: '#C25953',
  },
  scoreText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
  },
  textHigh: {
    color: '#5B8266',
  },
  textMid: {
    color: '#D9822B',
  },
  textLow: {
    color: '#C25953',
  },
  summarySnippet: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
    marginVertical: SPACING.xs,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statTag: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyPdfBtn: {
    backgroundColor: 'rgba(0, 210, 255, 0.12)',
    padding: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  deleteBtn: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyIconContainer: {
    marginBottom: SPACING.md,
    opacity: 0.5,
  },
  emptyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.lg,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryStart,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: RADIUS.full,
  },
  emptyActionText: {
    fontFamily: FONTS.bold,
    color: '#fff',
    fontSize: 14,
  },
});

export default ScoreHistoryScreen;
