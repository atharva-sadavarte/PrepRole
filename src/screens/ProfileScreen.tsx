import React, {useRef, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {supabase} from '../lib/supabase';
import {useTheme} from '../context/ThemeContext';
import {COLORS, SPACING, RADIUS, ICON_SIZES, FONTS, SHADOWS} from '../lib/theme';
import {getUserAnalyses} from '../services/resumeService';
import Icon from '../components/Icon';
import type {Session} from '@supabase/supabase-js';

const {width} = Dimensions.get('window');

interface ProfileScreenProps {
  session: Session;
  navigation?: any;
}

const ProfileScreen = ({session}: ProfileScreenProps) => {
  const {colors, isDark, themeSetting, setThemeSetting} = useTheme();
  const [totalScans, setTotalScans] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [avgScore, setAvgScore] = useState(0);

  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const modalFadeAnim = useRef(new Animated.Value(0)).current;
  const modalScaleAnim = useRef(new Animated.Value(0.9)).current;

  const user = session.user;
  const userName =
    user.user_metadata?.full_name || user.user_metadata?.name || 'User';
  const userAvatar = user.user_metadata?.avatar_url;
  const userEmail = user.email;

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const analyses = await getUserAnalyses(session.user.id);
        setTotalScans(analyses.length);
        if (analyses.length > 0) {
          const scores = analyses.map(a => a.overall_score);
          setBestScore(Math.max(...scores));
          setAvgScore(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length));
        }
      } catch (error) {
        console.error('Error fetching profile stats:', error);
      }
    };

    fetchStats();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [session.user.id, fadeAnim, slideAnim]);

  const handleSignOutPress = () => {
    setShowSignOutModal(true);
    Animated.parallel([
      Animated.timing(modalFadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(modalScaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleCancelSignOut = () => {
    if (isSigningOut) return;
    Animated.parallel([
      Animated.timing(modalFadeAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(modalScaleAnim, {
        toValue: 0.9,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSignOutModal(false);
    });
  };

  const handleConfirmSignOut = async () => {
    setIsSigningOut(true);
    try {
      try {
        await GoogleSignin.signOut();
      } catch {
        // Google sign out may fail if not signed in via Google
      }
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out:', err);
      setIsSigningOut(false);
    }
  };

  const statItems = [
    {
      icon: 'analytics-outline',
      label: 'Total Scans',
      value: totalScans.toString(),
      unit: '',
      gradient: [colors.accent, colors.primaryEnd],
    },
    {
      icon: 'trophy-outline',
      label: 'Best Score',
      value: bestScore > 0 ? bestScore.toString() : '—',
      unit: bestScore > 0 ? '/100' : '',
      gradient: ['#C27322', '#A35D16'],
    },
    {
      icon: 'trending-up-outline',
      label: 'Avg Score',
      value: avgScore > 0 ? avgScore.toString() : '—',
      unit: avgScore > 0 ? '/100' : '',
      gradient: ['#5B8266', '#4A7C59'],
    },
  ];

  const menuItems = [
    {
      icon: 'shield-checkmark-outline',
      label: 'Privacy Policy',
      onPress: () => {},
    },
    {
      icon: 'document-text-outline',
      label: 'Terms of Service',
      onPress: () => {},
    },
    {icon: 'help-circle-outline', label: 'Help & Support', onPress: () => {}},
    {
      icon: 'information-circle-outline',
      label: 'About PrepRole',
      onPress: () => {},
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={[colors.bgDark, colors.gradientMiddle, colors.gradientEnd]}
        style={styles.gradient}>
        {/* Fixed Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.bgDark,
              borderBottomColor: colors.border,
            },
          ]}>
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
                <Icon name="person" size={11} color={colors.accent} />
              </View>
              <Text
                style={[styles.headerBadgeText, {color: colors.textPrimary}]}>
                ACCOUNT & PREFERENCES
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleSignOutPress}
              activeOpacity={0.8}
              style={[
                styles.quickLogoutBtn,
                {
                  backgroundColor: colors.bgCardLight,
                  borderColor: colors.border,
                },
              ]}>
              <Icon
                name="log-out-outline"
                size={13}
                color={colors.error}
                style={{marginRight: 4}}
              />
              <Text style={[styles.quickLogoutText, {color: colors.error}]}>
                Sign Out
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
            Profile
          </Text>
          <Text style={[styles.headerSubtitle, {color: colors.textSecondary}]}>
            Manage personal info, account settings, and application appearance.
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>

          {/* Profile Card */}
          <Animated.View
            style={[
              styles.profileCard,
              {
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
                shadowColor: colors.cardShadow,
                opacity: fadeAnim,
                transform: [{translateY: slideAnim}],
              },
            ]}>
            <View style={styles.avatarWrapper}>
              <LinearGradient
                colors={[colors.primaryStart, colors.accent]}
                style={styles.avatarGradientRing}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}>
                {userAvatar ? (
                  <Image source={{uri: userAvatar}} style={styles.avatar} />
                ) : (
                  <View
                    style={[
                      styles.avatarPlaceholder,
                      {backgroundColor: colors.bgCardLight},
                    ]}>
                    <Text
                      style={[
                        styles.avatarInitial,
                        {color: colors.primaryStart},
                      ]}>
                      {userName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </View>

            <Text style={[styles.userName, {color: colors.textPrimary}]}>
              {userName}
            </Text>
            <Text style={[styles.userEmail, {color: colors.textSecondary}]}>
              {userEmail}
            </Text>

            {/* Member badge */}
            <View
              style={[
                styles.memberBadge,
                {
                  backgroundColor: colors.accentSoft,
                  borderColor: colors.border,
                },
              ]}>
              <Icon
                name="diamond-outline"
                size={ICON_SIZES.sm}
                color={colors.accent}
              />
              <Text style={[styles.memberText, {color: colors.accent}]}>
                Free Plan
              </Text>
            </View>
          </Animated.View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            {statItems.map((stat, idx) => (
              <View
                key={idx}
                style={[
                  styles.statCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    shadowColor: colors.cardShadow,
                  },
                ]}>
                <LinearGradient
                  colors={stat.gradient}
                  style={styles.statIconBg}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}>
                  <Icon
                    name={stat.icon}
                    size={ICON_SIZES.md}
                    color="#FFFFFF"
                  />
                </LinearGradient>
                <View style={styles.statValueRow}>
                  <Text
                    style={[styles.statValue, {color: colors.textPrimary}]}
                    numberOfLines={1}
                    adjustsFontSizeToFit>
                    {stat.value}
                  </Text>
                  {!!stat.unit && (
                    <Text
                      style={[styles.statUnit, {color: colors.textSecondary}]}
                      numberOfLines={1}>
                      {stat.unit}
                    </Text>
                  )}
                </View>
                <Text
                  style={[styles.statLabel, {color: colors.textSecondary}]}
                  numberOfLines={1}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Appearance / Theme Selector Section */}
          <View
            style={[
              styles.appearanceCard,
              {
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
                shadowColor: colors.cardShadow,
              },
            ]}>
            <View style={styles.appearanceHeader}>
              <View style={styles.appearanceHeaderLeft}>
                <Icon
                  name="color-palette-outline"
                  size={ICON_SIZES.md}
                  color={colors.primaryStart}
                />
                <Text
                  style={[
                    styles.appearanceTitle,
                    {color: colors.textPrimary},
                  ]}>
                  Appearance
                </Text>
              </View>
              <Text
                style={[
                  styles.appearanceSubtitle,
                  {color: colors.textSecondary},
                ]}>
                {themeSetting === 'system'
                  ? 'System Auto'
                  : themeSetting === 'dark'
                  ? 'Dark Mode'
                  : 'Light Mode'}
              </Text>
            </View>

            <View
              style={[
                styles.themeToggleContainer,
                {
                  backgroundColor: colors.bgInput,
                  borderColor: colors.border,
                },
              ]}>
              {(
                [
                  {
                    key: 'system',
                    label: 'System',
                    icon: 'phone-portrait-outline',
                  },
                  {key: 'dark', label: 'Dark', icon: 'moon-outline'},
                  {key: 'light', label: 'Light', icon: 'sunny-outline'},
                ] as const
              ).map(item => {
                const active = themeSetting === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => setThemeSetting(item.key)}
                    activeOpacity={0.8}
                    style={[
                      styles.themeOption,
                      active && [
                        styles.themeOptionActive,
                        {
                          backgroundColor: colors.primaryStart,
                          shadowColor: colors.primaryStart,
                        },
                      ],
                    ]}>
                    <Icon
                      name={item.icon}
                      size={ICON_SIZES.sm}
                      color={active ? '#FFFFFF' : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.themeOptionText,
                        {color: active ? '#FFFFFF' : colors.textSecondary},
                        active && {fontWeight: '700'},
                      ]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Menu Items */}
          <View style={styles.menuSection}>
            {menuItems.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.menuItem,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    shadowColor: colors.cardShadow,
                  },
                ]}
                onPress={item.onPress}
                activeOpacity={0.7}>
                <View style={styles.menuLeft}>
                  <Icon
                    name={item.icon}
                    size={ICON_SIZES.lg}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[styles.menuLabel, {color: colors.textPrimary}]}>
                    {item.label}
                  </Text>
                </View>
                <Icon
                  name="chevron-forward"
                  size={ICON_SIZES.md}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Sign Out Button */}
          <TouchableOpacity
            onPress={handleSignOutPress}
            style={[
              styles.signOutButton,
              {
                backgroundColor: isDark
                  ? 'rgba(239, 68, 68, 0.08)'
                  : 'rgba(220, 38, 38, 0.06)',
                borderColor: isDark
                  ? 'rgba(239, 68, 68, 0.25)'
                  : 'rgba(220, 38, 38, 0.2)',
              },
            ]}
            activeOpacity={0.8}>
            <Icon
              name="log-out-outline"
              size={ICON_SIZES.lg}
              color={colors.error}
            />
            <Text style={[styles.signOutText, {color: colors.error}]}>
              Sign Out
            </Text>
          </TouchableOpacity>

          {/* App Version */}
          <Text style={[styles.versionText, {color: colors.textMuted}]}>
            PrepRole v1.0.0
          </Text>
        </ScrollView>
      </LinearGradient>

      {/* Custom Warm Sign Out Confirmation Modal */}
      {showSignOutModal && (
        <Animated.View
          style={[
            styles.modalBackdrop,
            {
              opacity: modalFadeAnim,
            },
          ]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleCancelSignOut}
          />
          <Animated.View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
                transform: [{scale: modalScaleAnim}],
                ...SHADOWS.elevated,
              },
            ]}>
            <View
              style={[
                styles.modalIconCircle,
                {
                  backgroundColor: isDark
                    ? 'rgba(239, 68, 68, 0.12)'
                    : 'rgba(220, 38, 38, 0.08)',
                  borderColor: isDark
                    ? 'rgba(239, 68, 68, 0.25)'
                    : 'rgba(220, 38, 38, 0.18)',
                },
              ]}>
              <Icon name="log-out-outline" size={26} color={colors.error} />
            </View>

            <Text style={[styles.modalTitle, {color: colors.textPrimary}]}>
              Sign Out
            </Text>
            <Text style={[styles.modalMessage, {color: colors.textSecondary}]}>
              Are you sure you want to sign out of PrepRole? You can sign back in
              anytime to access your resume scans and history.
            </Text>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  {
                    backgroundColor: colors.bgCardLight,
                    borderColor: colors.border,
                  },
                ]}
                onPress={handleCancelSignOut}
                activeOpacity={0.7}
                disabled={isSigningOut}>
                <Text
                  style={[
                    styles.modalCancelText,
                    {color: colors.textPrimary},
                  ]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  {
                    backgroundColor: colors.error,
                  },
                ]}
                onPress={handleConfirmSignOut}
                activeOpacity={0.8}
                disabled={isSigningOut}>
                {isSigningOut ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Sign Out</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      )}
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
  scrollContent: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl * 2,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl + 8,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    zIndex: 10,
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
  quickLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  quickLogoutText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
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
    marginBottom: SPACING.xs,
  },
  profileCard: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    elevation: 4,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  avatarWrapper: {
    marginBottom: SPACING.md,
  },
  avatarGradientRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontFamily: FONTS.bold,
    fontSize: 36,
    color: COLORS.textPrimary,
  },
  userName: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  userEmail: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  memberText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
    alignItems: 'center',
    borderWidth: 1,
    elevation: 3,
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  statIconBg: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontFamily: FONTS.bold,
    fontSize: 18,
  },
  statUnit: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    marginLeft: 1,
  },
  statLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    textAlign: 'center',
  },
  appearanceCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    elevation: 3,
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  appearanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  appearanceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + 2,
  },
  appearanceTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
  },
  appearanceSubtitle: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  themeToggleContainer: {
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    padding: 4,
    borderWidth: 1,
    gap: 4,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  themeOptionActive: {
    elevation: 4,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  themeOptionText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },
  menuSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  menuLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  signOutText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
  },
  versionText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
    paddingHorizontal: SPACING.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  modalIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    letterSpacing: -0.3,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  modalMessage: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  modalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: SPACING.sm,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});

export default ProfileScreen;
