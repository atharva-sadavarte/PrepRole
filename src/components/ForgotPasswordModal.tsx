import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useTheme} from '../context/ThemeContext';
import {SPACING, RADIUS, ICON_SIZES, FONTS} from '../lib/theme';
import Icon from './Icon';
import {
  sendPasswordResetEmail,
  verifyPasswordResetOtp,
  updateUserPassword,
  isValidEmail,
  isValidPassword,
} from '../services/authService';

interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  initialEmail?: string;
  isDirectRecovery?: boolean; // When triggered from a deep link recovery session
  onSuccess?: () => void;
}

type Step = 'REQUEST' | 'VERIFY_OTP' | 'SUCCESS';

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  visible,
  onClose,
  initialEmail = '',
  isDirectRecovery = false,
  onSuccess,
}) => {
  const {colors, isDark} = useTheme();

  const [step, setStep] = useState<Step>(
    isDirectRecovery ? 'VERIFY_OTP' : 'REQUEST',
  );
  const [email, setEmail] = useState(initialEmail);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Sync initial email when modal opens
  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  useEffect(() => {
    if (isDirectRecovery) {
      setStep('VERIFY_OTP');
    }
  }, [isDirectRecovery]);

  // Resend countdown timer
  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const resetForm = () => {
    setStep(isDirectRecovery ? 'VERIFY_OTP' : 'REQUEST');
    setOtpCode('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Step 1: Send reset email / code
  const handleSendResetEmail = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      Alert.alert('Required', 'Please enter your registered email address.');
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      const res = await sendPasswordResetEmail(cleanEmail);
      if (res.success) {
        setStep('VERIFY_OTP');
        setResendTimer(60);
      } else {
        Alert.alert('Request Failed', res.message || 'Could not send reset code.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  // Resend reset code
  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    try {
      setLoading(true);
      const res = await sendPasswordResetEmail(email.trim());
      if (res.success) {
        setResendTimer(60);
        Alert.alert('Code Sent', 'A fresh verification code has been sent to your email.');
      } else {
        Alert.alert('Resend Failed', res.message);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and update password
  const handleUpdatePassword = async () => {
    if (!isDirectRecovery && !otpCode.trim()) {
      Alert.alert('Required', 'Please enter the verification code sent to your email.');
      return;
    }

    if (!newPassword) {
      Alert.alert('Required', 'Please enter a new password.');
      return;
    }

    if (!isValidPassword(newPassword)) {
      Alert.alert(
        'Weak Password',
        'Password must be at least 6 characters long.',
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Password Mismatch', 'New passwords do not match.');
      return;
    }

    try {
      setLoading(true);

      // If user came via OTP code, verify OTP first
      if (!isDirectRecovery) {
        const otpRes = await verifyPasswordResetOtp(email.trim(), otpCode.trim());
        if (!otpRes.success) {
          Alert.alert(
            'Verification Failed',
            otpRes.message || 'Invalid or expired verification code.',
          );
          setLoading(false);
          return;
        }
      }

      // Session is now active, update password
      const updateRes = await updateUserPassword(newPassword);
      if (!updateRes.success) {
        Alert.alert(
          'Update Failed',
          updateRes.message || 'Could not update password. Please try again.',
        );
        return;
      }

      setStep('SUCCESS');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    handleClose();
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}>
      <View style={[styles.overlay, {backgroundColor: colors.overlay}]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}>
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            bounces={false}
            keyboardShouldPersistTaps="handled">
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: colors.bgCard,
                  borderColor: isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : colors.border,
                },
              ]}>
              {/* Header with Close Icon */}
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.iconCircle,
                    {
                      backgroundColor: isDark
                        ? 'rgba(196, 154, 114, 0.14)'
                        : 'rgba(166, 124, 82, 0.12)',
                      borderColor: isDark
                        ? 'rgba(196, 154, 114, 0.28)'
                        : 'rgba(166, 124, 82, 0.22)',
                    },
                  ]}>
                  <Icon
                    name={
                      step === 'SUCCESS'
                        ? 'checkmark-circle'
                        : step === 'VERIFY_OTP'
                        ? 'shield-checkmark'
                        : 'key'
                    }
                    size={22}
                    color={
                      step === 'SUCCESS' ? colors.success : colors.primaryStart
                    }
                  />
                </View>
                <TouchableOpacity
                  onPress={handleClose}
                  style={styles.closeBtn}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <Icon name="close" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Step 1: Request Password Reset */}
              {step === 'REQUEST' && (
                <>
                  <Text style={[styles.title, {color: colors.textPrimary}]}>
                    Reset Password
                  </Text>
                  <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
                    Enter your registered email address. We will send you a
                    verification code to create a new password.
                  </Text>

                  {/* Email Input */}
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>
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
                        style={styles.inputLeadingIcon}
                      />
                      <TextInput
                        style={[styles.input, {color: colors.textPrimary}]}
                        placeholder="you@example.com"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={email}
                        onChangeText={setEmail}
                      />
                    </View>
                  </View>

                  {/* Send Button */}
                  <TouchableOpacity
                    onPress={handleSendResetEmail}
                    disabled={loading}
                    activeOpacity={0.88}
                    style={styles.primaryButtonWrapper}>
                    <LinearGradient
                      colors={[colors.primaryStart, colors.primaryEnd]}
                      style={styles.primaryGradientButton}
                      start={{x: 0, y: 0}}
                      end={{x: 1, y: 0}}>
                      {loading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryButtonText}>
                          Send Verification Code
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleClose}
                    style={styles.cancelButton}>
                    <Text
                      style={[styles.cancelButtonText, {color: colors.textSecondary}]}>
                      Back to Sign In
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Step 2: Verify Code and Set New Password */}
              {step === 'VERIFY_OTP' && (
                <>
                  <Text style={[styles.title, {color: colors.textPrimary}]}>
                    Set New Password
                  </Text>
                  <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
                    {isDirectRecovery
                      ? 'Please enter and confirm your new account password.'
                      : `Enter the code sent to ${email} and set your new password.`}
                  </Text>

                  {/* OTP Input (only if not already authenticated via direct link) */}
                  {!isDirectRecovery && (
                    <View style={styles.inputGroup}>
                      <Text
                        style={[
                          styles.inputLabel,
                          {color: colors.textSecondary},
                        ]}>
                        Verification Code / Token
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
                          name="key-outline"
                          size={18}
                          color={colors.textSecondary}
                          style={styles.inputLeadingIcon}
                        />
                        <TextInput
                          style={[
                            styles.input,
                            {
                              color: colors.textPrimary,
                              letterSpacing: 3,
                              fontFamily: FONTS.semiBold,
                            },
                          ]}
                          placeholder="6-digit code"
                          placeholderTextColor={colors.textMuted}
                          autoCapitalize="none"
                          autoCorrect={false}
                          value={otpCode}
                          onChangeText={setOtpCode}
                        />
                      </View>
                    </View>
                  )}

                  {/* New Password */}
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>
                      New Password
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
                        style={styles.inputLeadingIcon}
                      />
                      <TextInput
                        style={[styles.input, {color: colors.textPrimary}]}
                        placeholder="At least 6 characters"
                        placeholderTextColor={colors.textMuted}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        value={newPassword}
                        onChangeText={setNewPassword}
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

                  {/* Confirm Password */}
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>
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
                        style={styles.inputLeadingIcon}
                      />
                      <TextInput
                        style={[styles.input, {color: colors.textPrimary}]}
                        placeholder="Re-enter new password"
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

                  {/* Action Button */}
                  <TouchableOpacity
                    onPress={handleUpdatePassword}
                    disabled={loading}
                    activeOpacity={0.88}
                    style={styles.primaryButtonWrapper}>
                    <LinearGradient
                      colors={[colors.primaryStart, colors.primaryEnd]}
                      style={styles.primaryGradientButton}
                      start={{x: 0, y: 0}}
                      end={{x: 1, y: 0}}>
                      {loading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryButtonText}>
                          Update Password
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Resend Code Link */}
                  {!isDirectRecovery && (
                    <View style={styles.resendRow}>
                      <Text
                        style={[styles.resendHint, {color: colors.textMuted}]}>
                        Didn't get the code?{' '}
                      </Text>
                      <TouchableOpacity
                        onPress={handleResendCode}
                        disabled={resendTimer > 0 || loading}>
                        <Text
                          style={[
                            styles.resendLink,
                            {
                              color:
                                resendTimer > 0
                                  ? colors.textMuted
                                  : colors.primaryStart,
                            },
                          ]}>
                          {resendTimer > 0
                            ? `Resend in ${resendTimer}s`
                            : 'Resend Code'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={() => setStep('REQUEST')}
                    style={styles.cancelButton}>
                    <Text
                      style={[styles.cancelButtonText, {color: colors.textSecondary}]}>
                      ‹ Change Email Address
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Step 3: Success Confirmation */}
              {step === 'SUCCESS' && (
                <View style={styles.successContainer}>
                  <Text style={[styles.title, {color: colors.textPrimary}]}>
                    Password Updated!
                  </Text>
                  <Text
                    style={[
                      styles.subtitle,
                      {color: colors.textSecondary, marginBottom: SPACING.lg},
                    ]}>
                    Your password has been reset successfully. You can now log in
                    with your new credentials.
                  </Text>

                  <TouchableOpacity
                    onPress={handleFinish}
                    activeOpacity={0.88}
                    style={styles.primaryButtonWrapper}>
                    <LinearGradient
                      colors={[colors.primaryStart, colors.primaryEnd]}
                      style={styles.primaryGradientButton}
                      start={{x: 0, y: 0}}
                      end={{x: 1, y: 0}}>
                      <Text style={styles.primaryButtonText}>
                        Continue to Sign In
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  modalCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    padding: 6,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    letterSpacing: 0.2,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: SPACING.md + 4,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12.5,
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  inputLeadingIcon: {
    marginRight: 9,
  },
  input: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 14,
    paddingVertical: 0,
  },
  primaryButtonWrapper: {
    marginTop: SPACING.xs,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  primaryGradientButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
  },
  primaryButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14.5,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginTop: 2,
  },
  cancelButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 13.5,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  resendHint: {
    fontFamily: FONTS.regular,
    fontSize: 12.5,
  },
  resendLink: {
    fontFamily: FONTS.semiBold,
    fontSize: 12.5,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
});

export default ForgotPasswordModal;

