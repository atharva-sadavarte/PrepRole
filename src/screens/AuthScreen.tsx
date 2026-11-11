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
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
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
import ForgotPasswordModal from '../components/ForgotPasswordModal';
import EmailVerificationModal from '../components/EmailVerificationModal';
import LegalDocumentModal, {LegalDocumentType} from '../components/LegalDocumentModal';
import {
  signInWithEmail,
  signUpWithEmail,
  isValidEmail,
  isValidPassword,
} from '../services/authService';

const {width, height} = Dimensions.get('window');

GoogleSignin.configure({
  webClientId:
    '879098542160-7374vk24bv0i9llla0ie3lr0b2o6ge4s.apps.googleusercontent.com',
  offlineAccess: true,
});

type AuthMode = 'signin' | 'signup';

const AuthScreen = () => {
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();

  // Mode state: 'signin' | 'signup'
  const [authMode, setAuthMode] = useState<AuthMode>('signin');

  // Form input fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Loading states
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Modals state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');
  const [legalModalType, setLegalModalType] = useState<LegalDocumentType | null>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const tabSlideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Tab switch handler
  const handleSwitchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    Animated.spring(tabSlideAnim, {
      toValue: mode === 'signin' ? 0 : 1,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();
  };

  // Email / Password submission
  const handleEmailAuth = async () => {
    const cleanEmail = email.trim();
    const cleanPassword = password;

    if (!cleanEmail) {
      Alert.alert('Required', 'Please enter your email address.');
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (!cleanPassword) {
      Alert.alert('Required', 'Please enter your password.');
      return;
    }

    if (authMode === 'signin') {
      // ─── Sign In Flow ──────────────────────────────────────
      try {
        setEmailLoading(true);
        const result = await signInWithEmail(cleanEmail, cleanPassword);

        if (!result.success) {
          if (result.isEmailUnconfirmed) {
            setUnconfirmedEmail(cleanEmail);
            setShowVerificationModal(true);
          } else {
            Alert.alert('Sign In Failed', result.message || 'Could not sign in.');
          }
        }
        // If success, App.tsx onAuthStateChange will automatically navigate
      } catch (err: any) {
        Alert.alert('Error', err?.message || 'Failed to sign in.');
      } finally {
        setEmailLoading(false);
      }
    } else {
      // ─── Sign Up Flow ──────────────────────────────────────
      const cleanName = fullName.trim();
      if (!cleanName) {
        Alert.alert('Required', 'Please enter your full name.');
        return;
      }

      if (!isValidPassword(cleanPassword)) {
        Alert.alert(
          'Password Too Short',
          'Password must be at least 6 characters long.',
        );
        return;
      }

      if (cleanPassword !== confirmPassword) {
        Alert.alert('Password Mismatch', 'Passwords do not match.');
        return;
      }

      try {
        setEmailLoading(true);
        const result = await signUpWithEmail(
          cleanEmail,
          cleanPassword,
          cleanName,
        );

        if (!result.success) {
          if (result.isAlreadyRegistered) {
            Alert.alert(
              'Account Exists',
              result.message,
              [
                {text: 'Cancel', style: 'cancel'},
                {
                  text: 'Switch to Sign In',
                  onPress: () => handleSwitchMode('signin'),
                },
              ],
            );
          } else {
            Alert.alert('Registration Failed', result.message);
          }
        } else if (result.requiresConfirmation) {
          // Email confirmation is required by Supabase
          setUnconfirmedEmail(cleanEmail);
          setShowVerificationModal(true);
        }
        // If not requiring confirmation and session exists, App.tsx will auto navigate
      } catch (err: any) {
        Alert.alert('Error', err?.message || 'Failed to create account.');
      } finally {
        setEmailLoading(false);
      }
    }
  };

  // Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
      const response = await GoogleSignin.signIn();

      if (response.type === 'cancelled') {
        console.log('Google Sign-In cancelled by user');
        return;
      }

      const idToken = response?.data?.idToken;

      if (!idToken) {
        throw new Error(
          'No ID token received from Google. Please verify webClientId configuration.',
        );
      }

      const {error} = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        console.error('Supabase auth error:', error.message);
        Alert.alert('Authentication Failed', error.message);
      }
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('Sign in cancelled');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('Sign in already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert(
          'Google Play Services Required',
          'Google Play Services is not available or needs to be updated on your device.',
        );
      } else if (String(error.code) === '10') {
        Alert.alert(
          'Google Play Config Error (10)',
          'DEVELOPER_ERROR (Code 10):\n\nThe SHA-1 fingerprint for this build has not been added to Google Cloud Console for package "com.preprole".',
        );
      } else {
        Alert.alert(
          'Sign-In Failed',
          error?.message || `Error code: ${error?.code || 'unknown'}`,
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.bgDark}]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={[colors.bgDark, colors.gradientMiddle, colors.gradientEnd]}
        style={styles.gradient}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop:
                  (Platform.OS === 'android'
                    ? (StatusBar.currentHeight || 28) + SPACING.md
                    : Math.max(insets.top, 24) + SPACING.sm),
                paddingBottom: Math.max(insets.bottom, 16) + SPACING.lg,
              },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}>
            <Animated.View
              style={[
                styles.contentWrapper,
                {opacity: fadeAnim, transform: [{translateY: slideAnim}]},
              ]}>
              {/* Header Branding */}
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

              {/* Title & Tagline */}
              <View style={styles.headerTextBlock}>
                <Text style={[styles.heroTitle, {color: colors.textPrimary}]}>
                  {authMode === 'signin' ? 'Welcome Back' : 'Create Account'}
                </Text>
                <Text style={[styles.heroSubtitle, {color: colors.textSecondary}]}>
                  {authMode === 'signin'
                    ? 'Sign in to access your CV analysis, ATS score, and mock interviews.'
                    : 'Get started with 3 free AI resume scans and personalized career coaching.'}
                </Text>
              </View>

              {/* Auth Mode Toggle Pill */}
              <View
                style={[
                  styles.tabContainer,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(0, 0, 0, 0.04)',
                    borderColor: colors.border,
                  },
                ]}>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    authMode === 'signin' && {
                      backgroundColor: colors.bgCard,
                      shadowColor: '#000',
                      shadowOffset: {width: 0, height: 2},
                      shadowOpacity: 0.12,
                      shadowRadius: 4,
                      elevation: 2,
                    },
                  ]}
                  onPress={() => handleSwitchMode('signin')}
                  activeOpacity={0.8}>
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color:
                          authMode === 'signin'
                            ? colors.textPrimary
                            : colors.textMuted,
                        fontFamily:
                          authMode === 'signin' ? FONTS.bold : FONTS.medium,
                      },
                    ]}>
                    Sign In
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    authMode === 'signup' && {
                      backgroundColor: colors.bgCard,
                      shadowColor: '#000',
                      shadowOffset: {width: 0, height: 2},
                      shadowOpacity: 0.12,
                      shadowRadius: 4,
                      elevation: 2,
                    },
                  ]}
                  onPress={() => handleSwitchMode('signup')}
                  activeOpacity={0.8}>
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color:
                          authMode === 'signup'
                            ? colors.textPrimary
                            : colors.textMuted,
                        fontFamily:
                          authMode === 'signup' ? FONTS.bold : FONTS.medium,
                      },
                    ]}>
                    Create Account
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Form Fields Card */}
              <View
                style={[
                  styles.formCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: isDark
                      ? 'rgba(255, 255, 255, 0.07)'
                      : colors.border,
                  },
                ]}>
                {/* Full Name Field (Sign Up Only) */}
                {authMode === 'signup' && (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.fieldLabel, {color: colors.textSecondary}]}>
                      Full Name
                    </Text>
                    <View
                      style={[
                        styles.inputContainer,
                        {
                          backgroundColor: colors.bgInput,
                          borderColor: colors.border,
                        },
                      ]}>
                      <Icon
                        name="person-outline"
                        size={18}
                        color={colors.textSecondary}
                        style={styles.fieldIcon}
                      />
                      <TextInput
                        style={[styles.textInput, {color: colors.textPrimary}]}
                        placeholder="e.g. Alex Morgan"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="words"
                        autoCorrect={false}
                        value={fullName}
                        onChangeText={setFullName}
                      />
                    </View>
                  </View>
                )}

                {/* Email Field */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.fieldLabel, {color: colors.textSecondary}]}>
                    Email Address
                  </Text>
                  <View
                    style={[
                      styles.inputContainer,
                      {
                        backgroundColor: colors.bgInput,
                        borderColor: colors.border,
                      },
                    ]}>
                    <Icon
                      name="mail-outline"
                      size={18}
                      color={colors.textSecondary}
                      style={styles.fieldIcon}
                    />
                    <TextInput
                      style={[styles.textInput, {color: colors.textPrimary}]}
                      placeholder="name@example.com"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={email}
                      onChangeText={setEmail}
                    />
                  </View>
                </View>

                {/* Password Field */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.fieldLabel, {color: colors.textSecondary}]}>
                    Password
                  </Text>
                  <View
                    style={[
                      styles.inputContainer,
                      {
                        backgroundColor: colors.bgInput,
                        borderColor: colors.border,
                      },
                    ]}>
                    <Icon
                      name="lock-closed-outline"
                      size={18}
                      color={colors.textSecondary}
                      style={styles.fieldIcon}
                    />
                    <TextInput
                      style={[styles.textInput, {color: colors.textPrimary}]}
                      placeholder={
                        authMode === 'signup'
                          ? 'Min. 6 characters'
                          : 'Your password'
                      }
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      value={password}
                      onChangeText={setPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                      <Icon
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={colors.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm Password (Sign Up Only) */}
                {authMode === 'signup' && (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.fieldLabel, {color: colors.textSecondary}]}>
                      Confirm Password
                    </Text>
                    <View
                      style={[
                        styles.inputContainer,
                        {
                          backgroundColor: colors.bgInput,
                          borderColor: colors.border,
                        },
                      ]}>
                      <Icon
                        name="lock-closed-outline"
                        size={18}
                        color={colors.textSecondary}
                        style={styles.fieldIcon}
                      />
                      <TextInput
                        style={[styles.textInput, {color: colors.textPrimary}]}
                        placeholder="Re-enter your password"
                        placeholderTextColor={colors.textMuted}
                        secureTextEntry={!showConfirmPassword}
                        autoCapitalize="none"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                      />
                      <TouchableOpacity
                        onPress={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                        <Icon
                          name={
                            showConfirmPassword
                              ? 'eye-off-outline'
                              : 'eye-outline'
                          }
                          size={18}
                          color={colors.textMuted}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Forgot Password Link (Sign In Only) */}
                {authMode === 'signin' && (
                  <TouchableOpacity
                    onPress={() => setShowForgotModal(true)}
                    style={styles.forgotPasswordContainer}
                    hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                    <Text
                      style={[
                        styles.forgotPasswordText,
                        {color: colors.primaryStart},
                      ]}>
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Submit Email Auth Button */}
                <TouchableOpacity
                  onPress={handleEmailAuth}
                  disabled={emailLoading || googleLoading}
                  activeOpacity={0.88}
                  style={styles.submitButtonWrapper}>
                  <LinearGradient
                    colors={[colors.primaryStart, colors.primaryEnd]}
                    style={styles.submitGradientButton}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 0}}>
                    {emailLoading ? (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.loadingTextWhite}>
                          {authMode === 'signin'
                            ? 'Signing In...'
                            : 'Creating Account...'}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.submitButtonText}>
                        {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* OR Divider */}
              <View style={styles.dividerRow}>
                <View
                  style={[styles.dividerLine, {backgroundColor: colors.border}]}
                />
                <Text style={[styles.dividerText, {color: colors.textMuted}]}>
                  or continue with
                </Text>
                <View
                  style={[styles.dividerLine, {backgroundColor: colors.border}]}
                />
              </View>

              {/* Google Sign-In Button */}
              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleSignIn}
                disabled={googleLoading || emailLoading}
                activeOpacity={0.88}>
                {googleLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#1F1F1F" />
                    <Text style={styles.loadingTextDark}>Connecting...</Text>
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

              {/* Terms of Service & Privacy Policy Footer */}
              <Text style={[styles.termsText, {color: colors.textMuted}]}>
                By continuing, you agree to our{' '}
                <Text
                  style={[styles.termsLink, {color: colors.primaryStart}]}
                  onPress={() => setLegalModalType('terms')}>
                  Terms
                </Text>{' '}
                &{' '}
                <Text
                  style={[styles.termsLink, {color: colors.primaryStart}]}
                  onPress={() => setLegalModalType('privacy')}>
                  Privacy Policy
                </Text>
              </Text>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        visible={showForgotModal}
        initialEmail={email}
        onClose={() => setShowForgotModal(false)}
        onSuccess={() => {
          setShowForgotModal(false);
          handleSwitchMode('signin');
        }}
      />

      {/* Email Verification Notice Modal */}
      <EmailVerificationModal
        visible={showVerificationModal}
        email={unconfirmedEmail}
        onClose={() => setShowVerificationModal(false)}
        onContinueToSignIn={() => {
          setShowVerificationModal(false);
          handleSwitchMode('signin');
        }}
      />

      {/* Legal Documents Modal */}
      {legalModalType && (
        <LegalDocumentModal
          visible={Boolean(legalModalType)}
          type={legalModalType}
          onClose={() => setLegalModalType(null)}
        />
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
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
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
  headerTextBlock: {
    marginBottom: SPACING.md,
  },
  heroTitle: {
    fontFamily: FONTS.bold,
    fontSize: 26,
    lineHeight: 33,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13.5,
    lineHeight: 19.5,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    padding: 4,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 13.5,
    letterSpacing: 0.1,
  },
  formCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.md + 4,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: SPACING.md,
  },
  inputGroup: {
    marginBottom: SPACING.sm + 4,
  },
  fieldLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    marginBottom: 5,
    letterSpacing: 0.1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  fieldIcon: {
    marginRight: 9,
  },
  textInput: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 14,
    paddingVertical: 0,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.sm,
    marginTop: -2,
  },
  forgotPasswordText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12.5,
  },
  submitButtonWrapper: {
    marginTop: SPACING.xs,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  submitGradientButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
  },
  submitButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingTextWhite: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 8,
  },
  loadingTextDark: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: '#1F1F1F',
    marginLeft: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    marginHorizontal: SPACING.sm,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    height: 50,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: SPACING.md,
  },
  googleLogo: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#1F1F1F',
    letterSpacing: 0.2,
  },
  termsText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    fontFamily: FONTS.semiBold,
  },
});

export default AuthScreen;
