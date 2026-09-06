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
import {useTheme} from '../context/ThemeContext';
import {RADIUS, SPACING, ICON_SIZES, FONTS} from '../lib/theme';
import {CVImprovement, PriorityLevel} from '../types/resume';
import Icon from './Icon';

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
  const {colors, isDark} = useTheme();
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
          bg: isDark ? 'rgba(194, 89, 83, 0.18)' : 'rgba(186, 74, 68, 0.12)',
          color: colors.error,
          label: 'CRITICAL FIX',
        };
      case 'medium':
        return {
          bg: isDark ? 'rgba(217, 130, 43, 0.18)' : 'rgba(194, 115, 34, 0.12)',
          color: colors.warning,
          label: 'RECOMMENDED',
        };
      case 'low':
      default:
        return {
          bg: isDark ? 'rgba(91, 130, 102, 0.18)' : 'rgba(74, 124, 89, 0.12)',
          color: colors.success,
          label: 'POLISH',
        };
    }
  };

  const priorityMeta = getPriorityStyle(item.priority);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.bgCard,
          borderColor: colors.border,
          shadowColor: colors.cardShadow,
          elevation: isDark ? 2 : 3,
        },
        completed && styles.cardCompleted,
      ]}>
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
          <View
            style={[
              styles.sectionBadge,
              {
                backgroundColor: isDark
                  ? colors.bgCardLight
                  : 'rgba(36, 35, 33, 0.05)',
                borderColor: colors.border,
              },
            ]}>
            <Text style={[styles.sectionText, {color: colors.textSecondary}]}>
              {item.section}
            </Text>
          </View>
        </View>

        {/* Done Checkbox */}
        <TouchableOpacity
          onPress={handleToggleDone}
          style={[
            styles.checkbox,
            {
              borderColor: completed ? colors.success : colors.border,
              backgroundColor: completed ? colors.success : 'transparent',
            },
          ]}
          activeOpacity={0.7}
          accessibilityLabel={completed ? 'Mark incomplete' : 'Mark complete'}>
          {completed && (
            <Icon name="checkmark" size={13} color="#FFFFFF" />
          )}
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
            {color: colors.textPrimary},
            completed && [styles.textCrossed, {color: colors.textMuted}],
          ]}>
          {item.title}
        </Text>

        <Text
          style={[styles.description, {color: colors.textSecondary}]}
          numberOfLines={expanded ? undefined : 2}>
          {item.description}
        </Text>
      </TouchableOpacity>

      {/* Expandable Example / Suggestion Box */}
      {expanded && item.example ? (
        <View
          style={[
            styles.exampleBox,
            {
              backgroundColor: isDark
                ? 'rgba(196, 154, 114, 0.08)'
                : 'rgba(166, 124, 82, 0.06)',
              borderColor: isDark
                ? 'rgba(196, 154, 114, 0.22)'
                : 'rgba(166, 124, 82, 0.2)',
              borderLeftColor: colors.accent,
            },
          ]}>
          <View style={styles.exampleHeader}>
            <View
              style={[
                styles.exampleIconBadge,
                {
                  backgroundColor: isDark
                    ? 'rgba(196, 154, 114, 0.2)'
                    : 'rgba(166, 124, 82, 0.15)',
                },
              ]}>
              <Icon
                name="bulb"
                size={12}
                color={colors.accent}
              />
            </View>
            <Text style={[styles.exampleTitle, {color: colors.accent}]}>
              Suggested Action / Rewrite
            </Text>
          </View>
          <Text style={[styles.exampleText, {color: colors.textPrimary}]}>
            {item.example}
          </Text>
        </View>
      ) : null}

      {/* Expand / Collapse Footer */}
      <TouchableOpacity
        onPress={toggleExpand}
        style={styles.footerToggle}
        activeOpacity={0.6}>
        <View style={styles.footerToggleRow}>
          <Text style={[styles.footerToggleText, {color: colors.accent}]}>
            {expanded ? 'Show Less' : 'Show Rewrite Example'}
          </Text>
          <Icon
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={ICON_SIZES.sm}
            color={colors.accent}
            style={{marginLeft: 4}}
          />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
  },
  cardCompleted: {
    opacity: 0.65,
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
    fontFamily: FONTS.bold,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  sectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  sectionText: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentClickable: {
    marginTop: SPACING.xs,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 4,
  },
  textCrossed: {
    textDecorationLine: 'line-through',
  },
  description: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  exampleBox: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  exampleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  exampleIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  exampleTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exampleText: {
    fontFamily: FONTS.mediumItalic,
    fontSize: 12,
    lineHeight: 18,
  },
  footerToggle: {
    alignSelf: 'flex-start',
    marginTop: SPACING.sm,
    paddingTop: 4,
  },
  footerToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerToggleText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
});

export default RecommendationCard;
