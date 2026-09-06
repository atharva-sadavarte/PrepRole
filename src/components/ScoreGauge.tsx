import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, Animated} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useTheme} from '../context/ThemeContext';
import {COLORS, RADIUS, SPACING, FONTS} from '../lib/theme';
import {ScoreTier} from '../types/resume';

interface ScoreGaugeProps {
  score: number;
  tier: ScoreTier;
  size?: number;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  score,
  tier,
  size = 180,
}) => {
  const animatedScore = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const [displayScore, setDisplayScore] = React.useState(0);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(animatedScore, {
        toValue: score,
        duration: 1200,
        useNativeDriver: false,
      }),
    ]).start();

    const listener = animatedScore.addListener(({value}) => {
      setDisplayScore(Math.round(value));
    });

    return () => {
      animatedScore.removeListener(listener);
    };
  }, [score, animatedScore, scaleAnim]);

  const {colors: themeColors} = useTheme();

  // Determine colors based on score
  const getColors = (): {gradient: string[]; badgeBg: string; text: string} => {
    if (score >= 85) {
      return {
        gradient: ['#5B8266', '#4A7C59'],
        badgeBg: 'rgba(91, 130, 102, 0.15)',
        text: '#5B8266',
      };
    }
    if (score >= 70) {
      return {
        gradient: [themeColors.accent, themeColors.primaryEnd],
        badgeBg: themeColors.accentSoft,
        text: themeColors.accent,
      };
    }
    if (score >= 50) {
      return {
        gradient: ['#D9822B', '#C27322'],
        badgeBg: 'rgba(217, 130, 43, 0.15)',
        text: '#D9822B',
      };
    }
    return {
      gradient: ['#C25953', '#A84842'],
      badgeBg: 'rgba(194, 89, 83, 0.15)',
      text: '#C25953',
    };
  };

  const colors = getColors();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          transform: [{scale: scaleAnim}],
        },
      ]}>
      {/* Outer Glow Ring */}
      <LinearGradient
        colors={colors.gradient}
        style={[
          styles.outerRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}>
        {/* Inner Card Background */}
        <View
          style={[
            styles.innerCircle,
            {
              width: size - 14,
              height: size - 14,
              borderRadius: (size - 14) / 2,
              backgroundColor: themeColors.bgCard,
            },
          ]}>
          <Text style={[styles.scoreNumber, {color: colors.text}]}>
            {displayScore}
          </Text>
          <Text style={[styles.scoreMax, {color: themeColors.textSecondary}]}>
            out of 100
          </Text>
          <View style={[styles.tierBadge, {backgroundColor: colors.badgeBg}]}>
            <Text style={[styles.tierText, {color: colors.text}]}>{tier}</Text>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: SPACING.md,
  },
  outerRing: {
    padding: 7,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  innerCircle: {
    backgroundColor: COLORS.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.sm,
  },
  scoreNumber: {
    fontFamily: FONTS.extraBold,
    fontSize: 50,
    letterSpacing: -1,
  },
  scoreMax: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: -4,
  },
  tierBadge: {
    marginTop: SPACING.xs,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  tierText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
