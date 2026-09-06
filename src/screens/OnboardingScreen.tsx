import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Animated,
  StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../context/ThemeContext';
import {COLORS, FONTS, RADIUS, SPACING, ICON_SIZES} from '../lib/theme';
import Icon from '../components/Icon';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  badge: string;
  badgeIcon: string;
  title: string;
  subtitle: string;
  tags: string[];
  type: 'score' | 'rewrite' | 'progress';
}

const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: 'slide-1',
    badge: 'AI RESUME BENCHMARK',
    badgeIcon: 'sparkles',
    title: 'Analyze & Score Your Resume Instantly',
    subtitle:
      'Upload your CV and get rigorous ATS match scoring, target role alignment, and missing keyword detection in seconds.',
    tags: ['ATS Compatible', 'Instant Analysis', 'Multimodal AI'],
    type: 'score',
  },
  {
    id: 'slide-2',
    badge: 'EXECUTIVE FEEDBACK',
    badgeIcon: 'bulb-outline',
    title: 'Transform Bullet Points into Impactful Wins',
    subtitle:
      'Receive concrete, before-and-after rewrite suggestions crafted by elite AI career coaches to make your accomplishments shine.',
    tags: ['Quantified Metrics', 'Action Verbs', 'Tailored Advice'],
    type: 'rewrite',
  },
  {
    id: 'slide-3',
    badge: 'CAREER COMPASS',
    badgeIcon: 'trophy-outline',
    title: 'Track Progress & Land Your Dream Job',
    subtitle:
      'Monitor your score growth across versions, build interview confidence, and take full control of your tech career trajectory.',
    tags: ['Version History', 'Interview Ready', 'Private & Secure'],
    type: 'progress',
  },
];

interface OnboardingScreenProps {
  onFinish: () => void;
  isModalMode?: boolean;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  onFinish,
  isModalMode = false,
}) => {
  const {colors, isDark} = useTheme();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (currentIndex < ONBOARDING_SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
      setCurrentIndex(prev => prev + 1);
    } else {
      onFinish();
    }
  };

  const handleSkip = () => {
    onFinish();
  };

  const onViewableItemsChanged = useRef(({viewableItems}: any) => {
    if (viewableItems && viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const renderVisualCard = (type: OnboardingSlide['type']) => {
    switch (type) {
      case 'score':
        return (
          <View
            style={[
              styles.visualCard,
              {
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
                shadowColor: colors.cardShadow,
              },
            ]}>
            {/* Target Role Tag */}
            <View style={styles.cardHeaderRow}>
              <View
                style={[
                  styles.rolePill,
                  {backgroundColor: colors.accentSoft, borderColor: colors.border},
                ]}>
                <Icon name="briefcase-outline" size={13} color={colors.accent} />
                <Text style={[styles.rolePillText, {color: colors.textPrimary}]}>
                  React Native Engineer
                </Text>
              </View>
              <View
                style={[
                  styles.matchBadge,
                  {backgroundColor: colors.success + '1F'},
                ]}>
                <Text style={[styles.matchBadgeText, {color: colors.success}]}>
                  Strong Match
                </Text>
              </View>
            </View>

            {/* Score Centerpiece */}
            <View style={styles.scoreRow}>
              <View
                style={[
                  styles.scoreCircle,
                  {
                    backgroundColor: colors.accentSoft,
                    borderColor: colors.accent,
                  },
                ]}>
                <Text style={[styles.scoreNumber, {color: colors.accent}]}>
                  88
                </Text>
                <Text style={[styles.scoreOutOf, {color: colors.textSecondary}]}>
                  / 100
                </Text>
              </View>

              <View style={styles.pillarsGrid}>
                <View
                  style={[
                    styles.pillarItem,
                    {backgroundColor: colors.bgCardLight},
                  ]}>
                  <Text style={[styles.pillarVal, {color: colors.textPrimary}]}>
                    90%
                  </Text>
                  <Text style={[styles.pillarLabel, {color: colors.textSecondary}]}>
                    Role Fit
                  </Text>
                </View>
                <View
                  style={[
                    styles.pillarItem,
                    {backgroundColor: colors.bgCardLight},
                  ]}>
                  <Text style={[styles.pillarVal, {color: colors.textPrimary}]}>
                    85%
                  </Text>
                  <Text style={[styles.pillarLabel, {color: colors.textSecondary}]}>
                    Skills
                  </Text>
                </View>
                <View
                  style={[
                    styles.pillarItem,
                    {backgroundColor: colors.bgCardLight},
                  ]}>
                  <Text style={[styles.pillarVal, {color: colors.textPrimary}]}>
                    84%
                  </Text>
                  <Text style={[styles.pillarLabel, {color: colors.textSecondary}]}>
                    Impact
                  </Text>
                </View>
                <View
                  style={[
                    styles.pillarItem,
                    {backgroundColor: colors.bgCardLight},
                  ]}>
                  <Text style={[styles.pillarVal, {color: colors.success}]}>
                    94%
                  </Text>
                  <Text style={[styles.pillarLabel, {color: colors.textSecondary}]}>
                    ATS Score
                  </Text>
                </View>
              </View>
            </View>
          </View>
        );

      case 'rewrite':
        return (
          <View
            style={[
              styles.visualCard,
              {
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
                shadowColor: colors.cardShadow,
              },
            ]}>
            {/* Before Box */}
            <View
              style={[
                styles.rewriteBox,
                {backgroundColor: colors.error + '1F', borderColor: colors.border},
              ]}>
              <View style={styles.rewriteLabelRow}>
                <Icon name="close-circle" size={13} color={colors.error} />
                <Text style={[styles.rewriteLabel, {color: colors.error}]}>
                  BEFORE (Generic)
                </Text>
              </View>
              <Text
                style={[
                  styles.rewriteContentText,
                  {color: colors.textSecondary},
                ]}>
                "Built mobile application features and fixed bugs for clients."
              </Text>
            </View>

            {/* Down Arrow connector */}
            <View style={styles.arrowRow}>
              <View
                style={[
                  styles.arrowCircle,
                  {backgroundColor: colors.accentSoft, borderColor: colors.border},
                ]}>
                <Icon name="arrow-down" size={12} color={colors.accent} />
              </View>
            </View>

            {/* After Box */}
            <View
              style={[
                styles.rewriteBox,
                {
                  backgroundColor: colors.success + '1F',
                  borderColor: colors.success,
                },
              ]}>
              <View style={styles.rewriteLabelRow}>
                <Icon name="checkmark-circle" size={13} color={colors.success} />
                <Text style={[styles.rewriteLabel, {color: colors.success}]}>
                  AFTER (High Impact)
                </Text>
              </View>
              <Text
                style={[
                  styles.rewriteContentText,
                  {color: colors.textPrimary},
                ]}>
                "Engineered 14+ scalable React Native features, boosting DAU by
                34% with 99.8% crash-free rate."
              </Text>
            </View>
          </View>
        );

      case 'progress':
        return (
          <View
            style={[
              styles.visualCard,
              {
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
                shadowColor: colors.cardShadow,
              },
            ]}>
            {/* Milestones timeline */}
            <View style={styles.milestoneItem}>
              <View
                style={[
                  styles.milestoneDot,
                  {backgroundColor: colors.error + '1F', borderColor: colors.error},
                ]}>
                <Text style={[styles.milestoneDotText, {color: colors.error}]}>
                  64
                </Text>
              </View>
              <View style={styles.milestoneInfo}>
                <Text style={[styles.milestoneTitle, {color: colors.textPrimary}]}>
                  Initial Resume Scan
                </Text>
                <Text
                  style={[
                    styles.milestoneSubtitle,
                    {color: colors.textSecondary},
                  ]}>
                  Missing key metrics and ATS keywords
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.milestoneConnector,
                {backgroundColor: colors.border},
              ]}
            />

            <View style={styles.milestoneItem}>
              <View
                style={[
                  styles.milestoneDot,
                  {
                    backgroundColor: colors.warning + '1F',
                    borderColor: colors.warning,
                  },
                ]}>
                <Text style={[styles.milestoneDotText, {color: colors.warning}]}>
                  78
                </Text>
              </View>
              <View style={styles.milestoneInfo}>
                <Text style={[styles.milestoneTitle, {color: colors.textPrimary}]}>
                  AI Rewrites Applied
                </Text>
                <Text
                  style={[
                    styles.milestoneSubtitle,
                    {color: colors.textSecondary},
                  ]}>
                  Quantified impact & tech stack tailored
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.milestoneConnector,
                {backgroundColor: colors.border},
              ]}
            />

            <View style={styles.milestoneItem}>
              <View
                style={[
                  styles.milestoneDot,
                  {
                    backgroundColor: colors.success + '1F',
                    borderColor: colors.success,
                  },
                ]}>
                <Text style={[styles.milestoneDotText, {color: colors.success}]}>
                  92
                </Text>
              </View>
              <View style={styles.milestoneInfo}>
                <Text style={[styles.milestoneTitle, {color: colors.textPrimary}]}>
                  Interview Ready!
                </Text>
                <Text
                  style={[
                    styles.milestoneSubtitle,
                    {color: colors.success},
                  ]}>
                  Strong Match • Ready for top tech roles
                </Text>
              </View>
            </View>
          </View>
        );
    }
  };

  const renderSlide = ({item}: {item: OnboardingSlide}) => {
    return (
      <View style={[styles.slideContainer, {width: SCREEN_WIDTH}]}>
        {/* Top Badge */}
        <View
          style={[
            styles.badgePill,
            {backgroundColor: colors.bgCard, borderColor: colors.border},
          ]}>
          <View
            style={[
              styles.badgeSparkleBg,
              {backgroundColor: colors.accentSoft},
            ]}>
            <Icon name={item.badgeIcon} size={11} color={colors.accent} />
          </View>
          <Text style={[styles.badgeText, {color: colors.textPrimary}]}>
            {item.badge}
          </Text>
        </View>

        {/* Title & Subtitle */}
        <Text style={[styles.title, {color: colors.textPrimary}]}>
          {item.title}
        </Text>
        <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
          {item.subtitle}
        </Text>

        {/* Feature Tags */}
        <View style={styles.tagRow}>
          {item.tags.map((tag, idx) => (
            <View
              key={idx}
              style={[
                styles.tagPill,
                {
                  backgroundColor: colors.bgCardLight,
                  borderColor: colors.border,
                },
              ]}>
              <Icon
                name="checkmark"
                size={11}
                color={colors.accent}
                style={{marginRight: 4}}
              />
              <Text style={[styles.tagText, {color: colors.textPrimary}]}>
                {tag}
              </Text>
            </View>
          ))}
        </View>

        {/* Visual Showcase Card */}
        <View style={styles.visualWrapper}>{renderVisualCard(item.type)}</View>
      </View>
    );
  };

  const isLastSlide = currentIndex === ONBOARDING_SLIDES.length - 1;

  return (
    <View style={[styles.container, {backgroundColor: colors.bgDark}]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={[colors.bgDark, colors.gradientMiddle, colors.gradientEnd]}
        style={styles.gradient}>
        {/* Top Header Row with Skip / Close button */}
        <View
          style={[
            styles.topNav,
            {
              paddingTop: Math.max(insets.top, StatusBar.currentHeight || 0) + 8,
            },
          ]}>
          <View style={styles.brandRow}>
            <View
              style={[
                styles.brandLogoBg,
                {backgroundColor: colors.accentSoft},
              ]}>
              <Icon name="sparkles" size={15} color={colors.accent} />
            </View>
            <Text style={[styles.brandTitle, {color: colors.textPrimary}]}>
              PrepRole
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.7}
            style={[
              styles.skipBtn,
              {backgroundColor: colors.bgCard, borderColor: colors.border},
            ]}>
            <Text style={[styles.skipBtnText, {color: colors.textSecondary}]}>
              {isModalMode ? 'Close' : 'Skip'}
            </Text>
            {isModalMode ? (
              <Icon
                name="close"
                size={12}
                color={colors.textSecondary}
                style={{marginLeft: 2}}
              />
            ) : (
              <Icon
                name="chevron-forward"
                size={12}
                color={colors.textSecondary}
                style={{marginLeft: 2}}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Carousel Content */}
        <FlatList
          ref={flatListRef}
          data={ONBOARDING_SLIDES}
          renderItem={renderSlide}
          keyExtractor={item => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onScroll={Animated.event(
            [{nativeEvent: {contentOffset: {x: scrollX}}}],
            {useNativeDriver: false},
          )}
          scrollEventThrottle={16}
          style={styles.carouselList}
        />

        {/* Bottom Bar: Dots & Action CTA */}
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: Math.max(insets.bottom, 24) + SPACING.md,
            },
          ]}>
          {/* Animated Dots */}
          <View style={styles.paginationDots}>
            {ONBOARDING_SLIDES.map((_, index) => {
              const inputRange = [
                (index - 1) * SCREEN_WIDTH,
                index * SCREEN_WIDTH,
                (index + 1) * SCREEN_WIDTH,
              ];

              const dotWidth = scrollX.interpolate({
                inputRange,
                outputRange: [8, 24, 8],
                extrapolate: 'clamp',
              });

              const dotOpacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.35, 1, 0.35],
                extrapolate: 'clamp',
              });

              return (
                <Animated.View
                  key={index}
                  style={[
                    styles.dot,
                    {
                      width: dotWidth,
                      opacity: dotOpacity,
                      backgroundColor:
                        currentIndex === index ? colors.accent : colors.textMuted,
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Primary CTA Button */}
          <TouchableOpacity
            onPress={handleNext}
            activeOpacity={0.88}
            style={styles.ctaButtonWrapper}>
            <LinearGradient
              colors={[colors.primaryStart, colors.primaryEnd]}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={styles.ctaButton}>
              <Text style={styles.ctaButtonText}>
                {isLastSlide ? 'Get Started' : 'Continue'}
              </Text>
              <Icon
                name={isLastSlide ? 'arrow-forward' : 'chevron-forward'}
                size={16}
                color="#FFFFFF"
                style={{marginLeft: 6}}
              />
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
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandLogoBg: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.xs,
  },
  brandTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    letterSpacing: 0.3,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  skipBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },
  carouselList: {
    flex: 1,
  },
  slideContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    alignItems: 'center',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  badgeSparkleBg: {
    width: 18,
    height: 18,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  badgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginBottom: SPACING.md,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  tagText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
  },
  visualWrapper: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: SPACING.sm,
  },
  visualCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    elevation: 4,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 5,
  },
  rolePillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
  matchBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: RADIUS.full,
  },
  matchBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreNumber: {
    fontFamily: FONTS.bold,
    fontSize: 26,
    lineHeight: 28,
  },
  scoreOutOf: {
    fontFamily: FONTS.medium,
    fontSize: 10,
  },
  pillarsGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pillarItem: {
    width: '47%',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  pillarVal: {
    fontFamily: FONTS.bold,
    fontSize: 13,
  },
  pillarLabel: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    marginTop: 1,
  },
  rewriteBox: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
  },
  rewriteLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  rewriteLabel: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  rewriteContentText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    lineHeight: 18,
  },
  arrowRow: {
    alignItems: 'center',
    marginVertical: 4,
  },
  arrowCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  milestoneDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  milestoneDotText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },
  milestoneSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    marginTop: 1,
  },
  milestoneConnector: {
    width: 2,
    height: 12,
    marginLeft: 18,
    marginVertical: 2,
  },
  bottomBar: {
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.md,
  },
  paginationDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  ctaButtonWrapper: {
    width: '100%',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  ctaButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});

export default OnboardingScreen;
