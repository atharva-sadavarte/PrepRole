import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import {COLORS, RADIUS, SPACING} from '../lib/theme';
import {CVImprovement, PriorityLevel} from '../types/resume';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface RecommendationCardProps {
  item: CVImprovement;
  onToggleComplete?: (id: string) => void;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  item,
  onToggleComplete,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [completed, setCompleted] = useState(item.completed || false);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const handleToggleDone = () => {
    const newState = !completed;
    setCompleted(newState);
    if (onToggleComplete) {
      onToggleComplete(item.id);
    }
  };

  const getPriorityStyle = (priority: PriorityLevel) => {
    switch (priority) {
      case 'high':
        return {
          bg: 'rgba(255, 82, 82, 0.15)',
          color: '#FF5252',
          label: 'CRITICAL FIX',
        };
      case 'medium':
        return {
          bg: 'rgba(255, 214, 0, 0.15)',
          color: '#FFD600',
          label: 'RECOMMENDED',
        };
      case 'low':
      default:
        return {
          bg: 'rgba(0, 230, 118, 0.15)',
          color: '#00E676',
          label: 'POLISH',
        };
    }
  };

  const priorityMeta = getPriorityStyle(item.priority);

  return (
    <View style={[styles.card, completed && styles.cardCompleted]}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.badgesRow}>
          <View
            style={[
              styles.priorityBadge,
              {backgroundColor: priorityMeta.bg},
            ]}>
            <Text style={[styles.priorityText, {color: priorityMeta.color}]}>
              {priorityMeta.label}
            </Text>
          </View>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionText}>{item.section}</Text>
          </View>
        </View>

        {/* Done Checkbox */}
        <TouchableOpacity
          onPress={handleToggleDone}
          style={[styles.checkbox, completed && styles.checkboxActive]}
          activeOpacity={0.7}>
          {completed && <Text style={styles.checkIcon}>✓</Text>}
        </TouchableOpacity>
      </View>

      {/* Main Title & Description */}
      <TouchableOpacity
        onPress={toggleExpand}
        activeOpacity={0.8}
        style={styles.contentClickable}>
        <Text
          style={[
            styles.title,
            completed && styles.textCrossed,
          ]}>
          {item.title}
        </Text>

        <Text
          style={styles.description}
          numberOfLines={expanded ? undefined : 2}>
          {item.description}
        </Text>
      </TouchableOpacity>

      {/* Expandable Example / Suggestion Box */}
      {expanded && item.example ? (
        <View style={styles.exampleBox}>
          <View style={styles.exampleHeader}>
            <Text style={styles.exampleEmoji}>💡</Text>
            <Text style={styles.exampleTitle}>Suggested Action / Rewrite</Text>
          </View>
          <Text style={styles.exampleText}>{item.example}</Text>
        </View>
      ) : null}

      {/* Expand / Collapse Footer */}
      <TouchableOpacity
        onPress={toggleExpand}
        style={styles.footerToggle}
        activeOpacity={0.6}>
        <Text style={styles.footerToggleText}>
          {expanded ? 'Show Less ▲' : 'Show Rewrite Example ▼'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardCompleted: {
    opacity: 0.65,
    borderColor: 'rgba(0, 230, 118, 0.3)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  sectionBadge: {
    backgroundColor: COLORS.bgCardLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  sectionText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  checkIcon: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
  },
  contentClickable: {
    marginTop: SPACING.xs,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: 4,
  },
  textCrossed: {
    textDecorationLine: 'line-through',
    color: COLORS.textSecondary,
  },
  description: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  exampleBox: {
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
  },
  exampleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  exampleEmoji: {
    fontSize: 14,
  },
  exampleTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exampleText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  footerToggle: {
    alignSelf: 'flex-start',
    marginTop: SPACING.sm,
    paddingTop: 4,
  },
  footerToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.accent,
  },
});
