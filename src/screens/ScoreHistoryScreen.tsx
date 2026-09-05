import React, {useState, useEffect} from 'react';
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
import {COLORS, RADIUS, SPACING} from '../lib/theme';
import {getUserAnalyses, deleteAnalysis} from '../services/resumeService';
import {ResumeAnalysisRecord} from '../types/resume';
import type {Session} from '@supabase/supabase-js';

interface ScoreHistoryScreenProps {
  session: Session;
  navigation: any;
}

export const ScoreHistoryScreen: React.FC<ScoreHistoryScreenProps> = ({
  session,
  navigation,
}) => {
  const [analyses, setAnalyses] = useState<ResumeAnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);

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
        style={styles.historyCard}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('CVScoreResult', {analysis: item})}>
        <View style={styles.cardTop}>
          <View style={styles.roleInfo}>
            <Text style={styles.roleTitle} numberOfLines={1}>
              {item.target_role}
            </Text>
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
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

        <Text style={styles.summarySnippet} numberOfLines={2}>
          {item.summary}
        </Text>

        <View style={styles.cardBottom}>
          <View style={styles.statsRow}>
            <Text style={styles.statTag}>
              🎯 Match: {item.breakdown?.relevance || 0}%
            </Text>
            <Text style={styles.statTag}>
              🛠️ Skills: {item.breakdown?.skills || 0}%
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDelete(item.id, item.target_role)}
            style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
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
          <Text style={styles.headerTitle}>Resume History</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('CVUpload')}
            style={styles.newScanBtn}>
            <Text style={styles.newScanText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={COLORS.primaryStart} />
          </View>
        ) : analyses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📄</Text>
            <Text style={styles.emptyTitle}>No CV Scans Yet</Text>
            <Text style={styles.emptySubtitle}>
              Scan your first resume against a target role to get an instant AI score and recommendations.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('CVUpload')}
              style={styles.emptyActionBtn}>
              <Text style={styles.emptyActionText}>Upload & Analyze CV</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={analyses}
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
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  newScanBtn: {
    backgroundColor: COLORS.primaryStart,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  newScanText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  dateText: {
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
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    borderWidth: 1.5,
    borderColor: '#00E676',
  },
  scoreMid: {
    backgroundColor: 'rgba(0, 210, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: '#00D2FF',
  },
  scoreLow: {
    backgroundColor: 'rgba(255, 82, 82, 0.15)',
    borderWidth: 1.5,
    borderColor: '#FF5252',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '900',
  },
  textHigh: {
    color: '#00E676',
  },
  textMid: {
    color: '#00D2FF',
  },
  textLow: {
    color: '#FF5252',
  },
  summarySnippet: {
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
    gap: 8,
  },
  statTag: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  deleteBtn: {
    padding: 4,
  },
  deleteBtnText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.lg,
  },
  emptyActionBtn: {
    backgroundColor: COLORS.primaryStart,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: RADIUS.full,
  },
  emptyActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default ScoreHistoryScreen;
