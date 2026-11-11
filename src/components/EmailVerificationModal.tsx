import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useTheme} from '../context/ThemeContext';
import {SPACING, RADIUS, FONTS} from '../lib/theme';
import Icon from './Icon';
import {resendVerificationEmail} from '../services/authService';

interface EmailVerificationModalProps {
  visible: boolean;
  email: string;
  onClose: () => void;
  onContinueToSignIn: () => void;
}

export const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({
  visible,
  email,
  onClose,
  onContinueToSignIn,
}) => {
  const {colors, isDark} = useTheme();
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);

  useEffect(() => {
    let interval: any;
    if (visible && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [visible, resendTimer]);

  // Reset timer when opened
  useEffect(() => {
    if (visible) {
      setResendTimer(60);
    }
  }, [visible]);

  const handleResend = async () => {
    if (resendTimer > 0 || !email) return;

    try {
      setLoading(true);
      const res = await resendVerificationEmail(email);
      if (res.success) {
        setResendTimer(60);
        Alert.alert(
          'Email Resent',
          `A new verification link has been sent to ${email}.`,
        );
      } else {
        Alert.alert('Resend Failed', res.message);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not resend email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={[styles.overlay, {backgroundColor: colors.overlay}]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.bgCard,
              borderColor: isDark
                ? 'rgba(255, 255, 255, 0.08)'
                : colors.border,
            },
          ]}>
          {/* Header Icon */}
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
              name="mail-unread-outline"
              size={26}
              color={colors.primaryStart}
            />
          </View>

          <Text style={[styles.title, {color: colors.textPrimary}]}>
            Verify Your Email
          </Text>

          <Text style={[styles.body, {color: colors.textSecondary}]}>
            We've sent an activation link to:
          </Text>
          <Text style={[styles.emailHighlight, {color: colors.primaryStart}]}>
            {email}
          </Text>

          <Text style={[styles.instructions, {color: colors.textMuted}]}>
            Please check your inbox (and spam/junk folder) and click the
            confirmation link to activate your PrepRole account.
          </Text>

          {/* Action: Proceed to Sign In */}
          <TouchableOpacity
            onPress={onContinueToSignIn}
            activeOpacity={0.88}
            style={styles.buttonWrapper}>
            <LinearGradient
              colors={[colors.primaryStart, colors.primaryEnd]}
              style={styles.gradientButton}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}>
              <Text style={styles.buttonText}>Back to Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Resend Link */}
          <View style={styles.resendRow}>
            <Text style={[styles.resendHint, {color: colors.textMuted}]}>
              Didn't receive the email?{' '}
            </Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={resendTimer > 0 || loading}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.primaryStart} />
              ) : (
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
                    : 'Resend Email'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  card: {
    width: '100%',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg + 4,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 21,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  body: {
    fontFamily: FONTS.regular,
    fontSize: 13.5,
    textAlign: 'center',
    marginTop: 2,
  },
  emailHighlight: {
    fontFamily: FONTS.semiBold,
    fontSize: 14.5,
    textAlign: 'center',
    marginVertical: 4,
  },
  instructions: {
    fontFamily: FONTS.regular,
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  buttonWrapper: {
    width: '100%',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  gradientButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
  },
  buttonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14.5,
    color: '#FFFFFF',
    letterSpacing: 0.2,
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
});

export default EmailVerificationModal;

