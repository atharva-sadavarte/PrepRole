import React, {useRef, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {supabase} from '../lib/supabase';
import {useTheme} from '../context/ThemeContext';
import {SPACING, RADIUS, ICON_SIZES, FONTS} from '../lib/theme';
import Icon from '../components/Icon';

const {width, height} = Dimensions.get('window');

GoogleSignin.configure({
  webClientId:
    '879098542160-7374vk24bv0i9llla0ie3lr0b2o6ge4s.apps.googleusercontent.com',
  offlineAccess: true,
});

const AuthScreen = () => {
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const buttonScale = useRef(new Animated.Value(0.92)).current;
  const featureAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(buttonScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.stagger(
        120,
        featureAnims.map(anim =>
          Animated.spring(anim, {
            toValue: 1,
            tension: 55,
            friction: 8,
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start();
  }, [buttonScale, fadeAnim, featureAnims, slideAnim]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response?.data?.idToken;

      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      const {error} = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        console.error('Supabase auth error:', error.message);
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('Sign in cancelled');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('Sign in already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        console.log('Play services not available');
      } else {
        console.error('Google Sign-In Error:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: 'document-text',
      title: 'ATS Resume Scoring',
      desc: 'Instant 0–100 rating with deep benchmark analysis',
      tag: '0–100 ATS',
    },
    {
      icon: 'sparkles',
      title: 'Job Role Match',
      desc: 'Pinpoint skill gaps & align to target job roles',
      tag: 'AI Match',
    },
    {
      icon: 'chatbubbles',
      title: 'AI Mock Interview',
      desc: 'Practice role-specific questions with live feedback',
      tag: 'Gemini AI',
    },
  ];

  return (
    <View style={[styles.container, {backgroundColor: colors.bgDark}]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <LinearGradient
        colors={[colors.bgDark, colors.gradientMiddle, colors.gradientEnd]}
        style={styles.gradient}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top, 24) + SPACING.md,
              paddingBottom: Math.max(insets.bottom, 16) + SPACING.sm,
            },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}>
          {/* Main Top Content */}
          <Animated.View
            style={[
              styles.mainContent,
              {opacity: fadeAnim, transform: [{translateY: slideAnim}]},
            ]}>
            {/* Logo Badge Row */}
            <View style={styles.logoRow}>
              <LinearGradient
                colors={[colors.primaryStart, colors.primaryEnd]}
                style={styles.logoBadge}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}>
                <Icon name="rocket" size={22} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.brandTextContainer}>
                <Text style={[styles.logoTitle, {color: colors.textPrimary}]}>
                  PrepRole
                </Text>
                <Text
                  style={[
                    styles.logoTagline,
                    {color: colors.primaryStart},
                  ]}>
                  AI CAREER COACH
                </Text>
              </View>
            </View>

            {/* Hero Section */}
            <View style={styles.heroSection}>
              <Text style={[styles.heroTitle, {color: colors.textPrimary}]}>
                Your AI-Powered{'\n'}
                <Text
                  style={[
                    styles.heroHighlight,
                    {color: colors.primaryStart},
                  ]}>
                  Career Coach
                </Text>
              </Text>
              <Text
                style={[
                  styles.heroSubtitle,
                  {color: colors.textSecondary},
                ]}>
                Upload your CV, get scored, and ace your interviews with
                personalized AI preparation.
              </Text>
            </View>

            {/* Features List */}
            <View style={styles.featuresList}>
              {features.map((feature, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.featureItem,
                    {
                      backgroundColor: isDark
                        ? 'rgba(28, 26, 24, 0.90)'
                        : colors.bgCard,
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.07)'
                        : colors.border,
                      opacity: featureAnims[index],
                      transform: [
                        {
                          translateX: featureAnims[index].interpolate({
                            inputRange: [0, 1],
                            outputRange: [-24, 0],
                          }),
                        },
                      ],
                    },
                  ]}>
                  <View
                    style={[
                      styles.featureIconBox,
                      {
                        backgroundColor: isDark
                          ? 'rgba(196, 154, 114, 0.12)'
                          : 'rgba(166, 124, 82, 0.10)',
                        borderColor: isDark
                          ? 'rgba(196, 154, 114, 0.28)'
                          : 'rgba(166, 124, 82, 0.22)',
                      },
                    ]}>
                    <Icon
                      name={feature.icon}
                      size={ICON_SIZES.md + 2}
                      color={colors.primaryStart}
                    />
                  </View>

                  <View style={styles.featureText}>
                    <View style={styles.featureHeaderRow}>
                      <Text
                        style={[
                          styles.featureTitle,
                          {color: colors.textPrimary},
                        ]}>
                        {feature.title}
                      </Text>
                      <View
                        style={[
                          styles.badgePill,
                          {
                            backgroundColor: isDark
                              ? 'rgba(196, 154, 114, 0.10)'
                              : 'rgba(166, 124, 82, 0.08)',
                            borderColor: isDark
                              ? 'rgba(196, 154, 114, 0.22)'
                              : 'rgba(166, 124, 82, 0.18)',
                          },
                        ]}>
                        <Text
                          style={[
                            styles.badgeText,
                            {color: colors.primaryStart},
                          ]}>
                          {feature.tag}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.featureDesc,
                        {color: colors.textSecondary},
                      ]}>
                      {feature.desc}
                    </Text>
                  </View>
                </Animated.View>
              ))}
            </View>
          </Animated.View>

          {/* Bottom Section */}
          <Animated.View
            style={[styles.bottomSection, {transform: [{scale: buttonScale}]}]}>
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleSignIn}
              disabled={loading}
              activeOpacity={0.88}>
              {loading ? (
                <View style={styles.buttonLoadingRow}>
                  <ActivityIndicator size="small" color="#1F1F1F" />
                  <Text style={styles.loadingText}>Connecting...</Text>
                </View>
              ) : (
                <>
                  <Image
                    source={require('../assets/google_logo.png')}
                    style={styles.googleLogo}
                    resizeMode="contain"
                  />
                  <Text style={styles.googleButtonText}>
                    Continue with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={[styles.termsText, {color: colors.textMuted}]}>
              By continuing, you agree to our{' '}
              <Text style={[styles.termsLink, {color: colors.primaryStart}]}>
                Terms
              </Text>{' '}
              &{' '}
              <Text style={[styles.termsLink, {color: colors.primaryStart}]}>
                Privacy Policy
              </Text>
            </Text>
          </Animated.View>
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
  ambientGlow: {
    position: 'absolute',
    top: -height * 0.1,
    alignSelf: 'center',
    width: width * 0.95,
    height: width * 0.95,
    borderRadius: (width * 0.95) / 2,
    opacity: 0.08,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
  },
  mainContent: {
    flex: 1,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  brandTextContainer: {
    marginLeft: SPACING.sm + 4,
  },
  logoTitle: {
    fontFamily: FONTS.bold,
    fontSize: 21,
    letterSpacing: 0.5,
    lineHeight: 25,
  },
  logoTagline: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  heroSection: {
    marginBottom: SPACING.lg,
  },
  heroTitle: {
    fontFamily: FONTS.bold,
    fontSize: 31,
    lineHeight: 39,
    letterSpacing: -0.3,
    marginBottom: SPACING.xs + 4,
  },
  heroHighlight: {},
  heroSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14.5,
    lineHeight: 22,
  },
  featuresList: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    marginBottom: 11,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  featureIconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    marginLeft: 13,
    flex: 1,
  },
  featureHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14.5,
    marginBottom: 2,
    letterSpacing: 0.1,
  },
  featureDesc: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 16.5,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 6,
    alignSelf: 'center',
  },
  badgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  bottomSection: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    height: 52,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  googleLogo: {
    width: 21,
    height: 21,
    marginRight: 11,
  },
  googleButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15.5,
    color: '#1F1F1F',
    letterSpacing: 0.2,
  },
  buttonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: FONTS.medium,
    fontSize: 14.5,
    color: '#1F1F1F',
    marginLeft: 10,
  },
  termsText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 13,
    lineHeight: 18,
  },
  termsLink: {
    fontFamily: FONTS.semiBold,
  },
});

export default AuthScreen;
