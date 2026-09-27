import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {PurchasesPackage} from 'react-native-purchases';
import Icon from './Icon';
import {useTheme} from '../context/ThemeContext';
import {FONTS, RADIUS, SPACING} from '../lib/theme';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
} from '../services/purchaseService';

const {width} = Dimensions.get('window');

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  currentCredits?: number;
  isPro?: boolean;
  reason?: 'out_of_credits' | 'upgrade' | 'pro_info';
}

type PlanType = 'monthly' | 'pack';

export const PaywallModal: React.FC<PaywallModalProps> = ({
  visible,
  onClose,
  onSuccess,
  currentCredits,
  isPro = false,
  reason = 'upgrade',
}) => {
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('monthly');
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);

  useEffect(() => {
    if (visible) {
      getOfferings().then(pkgs => {
        setPackages(pkgs);
      });
    }
  }, [visible]);

  const handlePurchase = async () => {
    if (isPro) {
      Alert.alert(
        'Pro Active',
        'You already have an active PrepRole Pro subscription with unlimited scans.',
        [{text: 'Great', onPress: onClose}],
      );
      return;
    }

    setLoading(true);
    try {
      // Find matching RevenueCat package if loaded from Google Play
      const targetPkg = packages.find(pkg => {
        if (selectedPlan === 'monthly') {
          return (
            pkg.packageType === 'MONTHLY' ||
            pkg.identifier.toLowerCase().includes('monthly') ||
            pkg.identifier.toLowerCase().includes('pro')
          );
        }
        return (
          pkg.packageType === 'CUSTOM' ||
          pkg.identifier.toLowerCase().includes('pack') ||
          pkg.identifier.toLowerCase().includes('5')
        );
      });

      if (targetPkg) {
        // Trigger real native Google Play Billing dialog
        const result = await purchasePackage(targetPkg);
        setLoading(false);
        if (result.success) {
          Alert.alert(
            'Upgrade Successful!',
            'Thank you for upgrading to PrepRole Pro! Your account now has full unlimited access.',
            [{text: 'Continue', onPress: () => { onClose(); onSuccess?.(); }}],
          );
        }
        return;
      }

      // Fallback in dev before Google Play products are approved by Google
      setTimeout(() => {
        setLoading(false);
        Alert.alert(
          'Google Play Billing Ready',
          selectedPlan === 'monthly'
            ? 'RevenueCat initialized. In production, this package initiates your monthly Pro subscription via Google Play Billing.'
            : 'RevenueCat initialized. In production, this triggers your one-time 5-scan purchase via Google Play Billing.',
          [
            {
              text: 'Got It',
              onPress: () => {
                onClose();
                onSuccess?.();
              },
            },
          ],
        );
      }, 600);
    } catch (err: any) {
      setLoading(false);
      Alert.alert('Purchase Incomplete', err.message || 'The purchase could not be completed. Please try again.');
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    const info = await restorePurchases();
    setLoading(false);
    if (info?.entitlements?.active?.pro) {
      Alert.alert(
        'Subscription Restored',
        'Your PrepRole Pro subscription has been successfully restored! You now have unlimited scans.',
        [{text: 'Continue', onPress: () => { onClose(); onSuccess?.(); }}],
      );
    } else {
      Alert.alert(
        'No Active Subscription',
        'No active Pro subscription was found for this Google Play account.',
      );
    }
  };

  const modalTitle = isPro
    ? 'PrepRole Pro Active'
    : currentCredits === 0 || reason === 'out_of_credits'
    ? 'Unlock PrepRole Pro'
    : 'Upgrade to PrepRole Pro';

  const modalSubtitle = isPro
    ? 'Your account has active Pro membership with unlimited ATS resume evaluations, role diagnostics, and interview drills.'
    : currentCredits === 0 || reason === 'out_of_credits'
    ? 'You have used all your free resume scans. Upgrade to Pro for unlimited scans, deep keyword diagnostics, and interview drills.'
    : 'Accelerate your job search with unlimited resume scans, advanced keyword optimization, and real-time interview prep.';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <View style={[styles.backdrop, {backgroundColor: colors.overlay}]}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.bgCard,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 16) + SPACING.md,
            },
          ]}>
          {/* Header Bar */}
          <View style={styles.topBar}>
            <View style={styles.dragIndicator} />
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, {backgroundColor: isDark ? '#262320' : '#EFECE5'}]}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Icon name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Crown / Diamond Badge */}
            <View style={styles.badgeRow}>
              <LinearGradient
                colors={[colors.primaryStart, colors.primaryEnd]}
                style={styles.crownBadge}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}>
                <Icon name="diamond" size={24} color="#FFFFFF" />
              </LinearGradient>
            </View>

            {/* Title & Subtitle */}
            <Text style={[styles.title, {color: colors.textPrimary}]}>
              {modalTitle}
            </Text>
            <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
              {modalSubtitle}
            </Text>

            {/* Plan 1: Monthly Pro (Best Value) */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setSelectedPlan('monthly')}
              style={[
                styles.planCard,
                {
                  backgroundColor: isDark ? '#1F1C1A' : '#FAF9F6',
                  borderColor:
                    selectedPlan === 'monthly' ? colors.primaryStart : colors.border,
                  borderWidth: selectedPlan === 'monthly' ? 2 : 1,
                },
              ]}>
              <View
                style={[
                  styles.popularTag,
                  {backgroundColor: colors.primaryStart},
                ]}>
                <Text style={styles.popularTagText}>MOST POPULAR</Text>
              </View>

              <View style={styles.planHeader}>
                <View style={styles.radioRow}>
                  <View
                    style={[
                      styles.radioButton,
                      {
                        borderColor:
                          selectedPlan === 'monthly'
                            ? colors.primaryStart
                            : colors.textMuted,
                      },
                    ]}>
                    {selectedPlan === 'monthly' && (
                      <View
                        style={[
                          styles.radioDot,
                          {backgroundColor: colors.primaryStart},
                        ]}
                      />
                    )}
                  </View>
                  <View style={styles.planTitleContainer}>
                    <Text style={[styles.planName, {color: colors.textPrimary}]}>
                      Monthly Pro
                    </Text>
                    <Text style={[styles.planDesc, {color: colors.textSecondary}]}>
                      Unlimited scans & continuous coaching
                    </Text>
                  </View>
                </View>

                <View style={styles.priceCol}>
                  <Text style={[styles.priceAmount, {color: colors.primaryStart}]}>
                    $4.99
                  </Text>
                  <Text style={[styles.pricePeriod, {color: colors.textMuted}]}>
                    / month
                  </Text>
                </View>
              </View>

              {/* Feature bullets */}
              <View style={styles.featuresList}>
                <View style={styles.featureBullet}>
                  <Icon name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={[styles.featureText, {color: colors.textPrimary}]}>
                    Unlimited full ATS resume evaluations
                  </Text>
                </View>
                <View style={styles.featureBullet}>
                  <Icon name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={[styles.featureText, {color: colors.textPrimary}]}>
                    Target role matching & keyword gap diagnostics
                  </Text>
                </View>
                <View style={styles.featureBullet}>
                  <Icon name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={[styles.featureText, {color: colors.textPrimary}]}>
                    Personalized bullet rewrites with quantified impact
                  </Text>
                </View>
                <View style={styles.featureBullet}>
                  <Icon name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={[styles.featureText, {color: colors.textPrimary}]}>
                    Cancel anytime in Google Play Store settings
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Plan 2: 5-Scan Pack */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setSelectedPlan('pack')}
              style={[
                styles.planCard,
                {
                  backgroundColor: isDark ? '#1F1C1A' : '#FAF9F6',
                  borderColor:
                    selectedPlan === 'pack' ? colors.primaryStart : colors.border,
                  borderWidth: selectedPlan === 'pack' ? 2 : 1,
                  marginTop: SPACING.md,
                },
              ]}>
              <View style={styles.planHeader}>
                <View style={styles.radioRow}>
                  <View
                    style={[
                      styles.radioButton,
                      {
                        borderColor:
                          selectedPlan === 'pack'
                            ? colors.primaryStart
                            : colors.textMuted,
                      },
                    ]}>
                    {selectedPlan === 'pack' && (
                      <View
                        style={[
                          styles.radioDot,
                          {backgroundColor: colors.primaryStart},
                        ]}
                      />
                    )}
                  </View>
                  <View style={styles.planTitleContainer}>
                    <Text style={[styles.planName, {color: colors.textPrimary}]}>
                      5-Scan Credit Pack
                    </Text>
                    <Text style={[styles.planDesc, {color: colors.textSecondary}]}>
                      One-time top up • Credits never expire
                    </Text>
                  </View>
                </View>

                <View style={styles.priceCol}>
                  <Text style={[styles.priceAmount, {color: colors.primaryStart}]}>
                    $1.99
                  </Text>
                  <Text style={[styles.pricePeriod, {color: colors.textMuted}]}>
                    one-time
                  </Text>
                </View>
              </View>

              <View style={styles.featuresList}>
                <View style={styles.featureBullet}>
                  <Icon name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={[styles.featureText, {color: colors.textPrimary}]}>
                    5 complete AI resume scans & scores
                  </Text>
                </View>
                <View style={styles.featureBullet}>
                  <Icon name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={[styles.featureText, {color: colors.textPrimary}]}>
                    No recurring subscription or auto-renew
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* CTA Button */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handlePurchase}
              disabled={loading}
              style={styles.ctaWrapper}>
              <LinearGradient
                colors={[colors.primaryStart, colors.primaryEnd]}
                style={styles.ctaButton}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}>
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon name="shield-checkmark" size={18} color="#FFFFFF" />
                    <Text style={styles.ctaText}>
                      {isPro ? 'Pro Subscription Active' : 'Continue with Google Play'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Restore purchases link */}
            <TouchableOpacity
              onPress={handleRestore}
              style={styles.restoreRow}>
              <Text style={[styles.restoreText, {color: colors.textMuted}]}>
                Restore Existing Purchases
              </Text>
            </TouchableOpacity>

            {/* Disclaimers */}
            <Text style={[styles.legalText, {color: colors.textMuted}]}>
              Payment will be charged to your Google Play account upon confirmation. Subscriptions renew automatically unless cancelled at least 24 hours prior to the end of the billing period in Google Play settings.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '88%',
    paddingHorizontal: SPACING.lg,
  },
  topBar: {
    alignItems: 'center',
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    position: 'relative',
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#888888',
    opacity: 0.4,
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: SPACING.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeRow: {
    alignItems: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  crownBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.xs,
  },
  planCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    position: 'relative',
  },
  popularTag: {
    position: 'absolute',
    top: -10,
    right: SPACING.md,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  popularTagText: {
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
    fontSize: 9.5,
    letterSpacing: 0.8,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  planTitleContainer: {
    flex: 1,
  },
  planName: {
    fontFamily: FONTS.bold,
    fontSize: 16,
  },
  planDesc: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    marginTop: 2,
  },
  priceCol: {
    alignItems: 'flex-end',
  },
  priceAmount: {
    fontFamily: FONTS.bold,
    fontSize: 18,
  },
  pricePeriod: {
    fontFamily: FONTS.regular,
    fontSize: 10.5,
  },
  featuresList: {
    marginTop: SPACING.sm + 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
    paddingTop: SPACING.sm,
  },
  featureBullet: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  featureText: {
    fontFamily: FONTS.medium,
    fontSize: 12.5,
    marginLeft: 8,
  },
  ctaWrapper: {
    marginTop: SPACING.lg,
  },
  ctaButton: {
    height: 52,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 4,
  },
  ctaText: {
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
    fontSize: 15.5,
    letterSpacing: 0.2,
  },
  restoreRow: {
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
  },
  restoreText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  legalText: {
    fontFamily: FONTS.regular,
    fontSize: 10.5,
    lineHeight: 14.5,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
});

export default PaywallModal;
