import React, {useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {supabase} from '../lib/supabase';
import {useTheme} from '../context/ThemeContext';
import {COLORS, SPACING, RADIUS, ICON_SIZES, FONTS} from '../lib/theme';
import Icon from '../components/Icon';

const {width, height} = Dimensions.get('window');

GoogleSignin.configure({
  webClientId:
    '879098542160-7374vk24bv0i9llla0ie3lr0b2o6ge4s.apps.googleusercontent.com',
  offlineAccess: true,
});

const AuthScreen = () => {
  const {colors, isDark} = useTheme();
  const [loading, setLoading] = React.useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const buttonScale = useRef(new Animated.Value(0.9)).current;
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
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(buttonScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      // Stagger feature items
      Animated.stagger(
        150,
        featureAnims.map(anim =>
          Animated.spring(anim, {
            toValue: 1,
            tension: 50,
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
      icon: 'document-text-outline',
      title: 'CV Score',
      desc: 'Get your resume rated by AI',
      gradient: [colors.accent, colors.primaryEnd] as string[],
    },
    {
      icon: 'checkmark-done-outline',
      title: 'Role Match',
      desc: 'Match skills to job roles',
      gradient: ['#5B8266', '#4A7C59'] as string[],
    },
    {
      icon: 'chatbubbles-outline',
      title: 'Mock Interview',
      desc: 'Practice with AI interviewer',
      gradient: ['#C27322', '#A35D16'] as string[],
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={[colors.bgDark, colors.gradientMiddle, colors.gradientEnd]}
        style={styles.gradient}>
        {/* Decorative elements */}
        <View
          style={[
            styles.decorCircle,
            styles.decorCircle1,
            {backgroundColor: colors.primaryStart},
          ]}
        />
        <View
          style={[
            styles.decorCircle,
            styles.decorCircle2,
            {backgroundColor: colors.accent},
          ]}
        />

        {/* Content */}
        <Animated.View
          style={[
            styles.content,
            {opacity: fadeAnim, transform: [{translateY: slideAnim}]},
          ]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <LinearGradient
                colors={[colors.primaryStart, colors.primaryEnd]}
                style={styles.logoSmall}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}>
                <Icon name="rocket" size={22} color="#FFFFFF" />
              </LinearGradient>
              <Text style={[styles.logoText, {color: colors.textPrimary}]}>
                PrepRole
              </Text>
            </View>

            <Text style={[styles.heroTitle, {color: colors.textPrimary}]}>
              Your AI-Powered{'\n'}
              <Text style={[styles.heroHighlight, {color: colors.primaryStart}]}>
                Career Coach
              </Text>
            </Text>
            <Text
              style={[styles.heroSubtitle, {color: colors.textSecondary}]}>
              Upload your CV, get scored, and ace your interviews with
              personalized AI preparation.
            </Text>
          </View>

          {/* Features */}
          <View style={styles.features}>
            {features.map((feature, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.featureItem,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    shadowColor: colors.cardShadow,
                    elevation: isDark ? 2 : 4,
                    opacity: featureAnims[index],
                    transform: [
                      {
                        translateX: featureAnims[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: [-30, 0],
                        }),
                      },
                    ],
                  },
                ]}>
                <LinearGradient
                  colors={feature.gradient}
                  style={styles.featureIcon}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}>
                  <Icon
                    name={feature.icon}
                    size={ICON_SIZES.lg}
                    color="#FFFFFF"
                  />
                </LinearGradient>
                <View style={styles.featureText}>
                  <Text
                    style={[
                      styles.featureTitle,
                      {color: colors.textPrimary},
                    ]}>
                    {feature.title}
                  </Text>
                  <Text
                    style={[
                      styles.featureDesc,
                      {color: colors.textSecondary},
                    ]}>
                    {feature.desc}
                  </Text>
                </View>
                <Icon
                  name="chevron-forward"
                  size={ICON_SIZES.md}
                  color={colors.textMuted}
                />
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* Sign In Button */}
        <Animated.View
          style={[styles.bottomSection, {transform: [{scale: buttonScale}]}]}>
          <TouchableOpacity
            style={[
              styles.googleButton,
              !isDark && {
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: colors.cardShadow,
                elevation: 4,
              },
            ]}
            onPress={handleGoogleSignIn}
            disabled={loading}
            activeOpacity={0.85}>
            <LinearGradient
              colors={isDark ? ['#FFFFFF', '#F0F0F5'] : ['#FFFFFF', '#F8FAFC']}
              style={styles.googleButtonGradient}
              start={{x: 0, y: 0}}
              end={{x: 0, y: 1}}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.primaryStart} />
              ) : (
                <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleButtonText}>
                    Continue with Google
                  </Text>
                </>
              )}
            </LinearGradient>
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
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.05,
  },
  decorCircle1: {
    width: width * 0.7,
    height: width * 0.7,
    backgroundColor: COLORS.primaryStart,
    top: -width * 0.15,
    right: -width * 0.2,
  },
  decorCircle2: {
    width: width * 0.5,
    height: width * 0.5,
    backgroundColor: COLORS.accent,
    bottom: height * 0.1,
    left: -width * 0.2,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: height * 0.08,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoSmall: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.textPrimary,
    marginLeft: SPACING.sm,
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontFamily: FONTS.bold,
    fontSize: 34,
    color: COLORS.textPrimary,
    lineHeight: 42,
    marginBottom: SPACING.md,
  },
  heroHighlight: {
    color: COLORS.primaryStart,
  },
  heroSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  features: {
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  featureTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  featureDesc: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  bottomSection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  googleButton: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  googleButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: SPACING.lg,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4285F4',
    marginRight: SPACING.sm,
  },
  googleButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#333333',
  },
  termsText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.md,
    lineHeight: 18,
  },
  termsLink: {
    fontFamily: FONTS.semiBold,
    color: COLORS.primaryStart,
  },
});

export default AuthScreen;
