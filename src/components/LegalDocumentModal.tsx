import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../context/ThemeContext';
import {SPACING, RADIUS, ICON_SIZES, FONTS} from '../lib/theme';
import Icon from './Icon';
import {
  LEGAL_CONFIG,
  PRIVACY_POLICY_DATA,
  TERMS_OF_SERVICE_DATA,
} from '../config/legal';

export type LegalDocumentType = 'privacy' | 'terms';

interface LegalDocumentModalProps {
  visible: boolean;
  type: LegalDocumentType;
  onClose: () => void;
}

export const LegalDocumentModal: React.FC<LegalDocumentModalProps> = ({
  visible,
  type,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();

  const isPrivacy = type === 'privacy';
  const data = isPrivacy ? PRIVACY_POLICY_DATA : TERMS_OF_SERVICE_DATA;
  const externalUrl = isPrivacy
    ? LEGAL_CONFIG.privacyPolicyUrl
    : LEGAL_CONFIG.termsOfServiceUrl;

  const handleOpenBrowser = async () => {
    try {
      await Linking.openURL(externalUrl);
    } catch {
      Alert.alert(
        'Unable to Open Browser',
        `Please open this link in your browser:\n\n${externalUrl}`,
        [{text: 'OK'}],
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <View style={[styles.container, {backgroundColor: colors.bgDark}]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        {/* Top Header */}
        <View
          style={[
            styles.header,
            {
              paddingTop: Math.max(insets.top, 16) + SPACING.xs,
              backgroundColor: colors.bgCard,
              borderBottomColor: colors.border,
            },
          ]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.headerIconButton}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text
              style={[styles.headerTitle, {color: colors.textPrimary}]}
              numberOfLines={1}>
              {data.title}
            </Text>
            <Text style={[styles.headerSubtitle, {color: colors.textMuted}]}>
              Effective {data.effectiveDate}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleOpenBrowser}
            style={[
              styles.openDocButton,
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
              name="open-outline"
              size={15}
              color={colors.primaryStart}
              style={{marginRight: 4}}
            />
            <Text style={[styles.openDocText, {color: colors.primaryStart}]}>
              Doc
            </Text>
          </TouchableOpacity>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {paddingBottom: Math.max(insets.bottom, 20) + SPACING.xl},
          ]}
          showsVerticalScrollIndicator={true}>
          {/* External Link Callout Card */}
          <TouchableOpacity
            onPress={handleOpenBrowser}
            activeOpacity={0.88}
            style={[
              styles.calloutCard,
              {
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
              },
            ]}>
            <View
              style={[
                styles.calloutIconCircle,
                {
                  backgroundColor: isDark
                    ? 'rgba(196, 154, 114, 0.15)'
                    : 'rgba(166, 124, 82, 0.12)',
                },
              ]}>
              <Icon
                name="document-text-outline"
                size={22}
                color={colors.primaryStart}
              />
            </View>
            <View style={styles.calloutTextContainer}>
              <Text
                style={[styles.calloutTitle, {color: colors.textPrimary}]}>
                Official Google Document
              </Text>
              <Text
                style={[styles.calloutSubtitle, {color: colors.textSecondary}]}>
                Tap to view the live, verified document in Google Docs.
              </Text>
            </View>
            <Icon
              name="chevron-forward"
              size={18}
              color={colors.primaryStart}
            />
          </TouchableOpacity>

          {/* Document Sections */}
          {data.sections.map((section, idx) => (
            <View
              key={idx}
              style={[
                styles.sectionCard,
                {
                  backgroundColor: colors.bgCard,
                  borderColor: isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : colors.border,
                },
              ]}>
              <Text
                style={[styles.sectionTitle, {color: colors.textPrimary}]}>
                {section.title}
              </Text>
              <Text
                style={[styles.sectionContent, {color: colors.textSecondary}]}>
                {section.content}
              </Text>
            </View>
          ))}

          {/* Action Footer */}
          <View style={styles.footerContainer}>
            <TouchableOpacity
              onPress={handleOpenBrowser}
              activeOpacity={0.88}
              style={styles.browserButtonWrapper}>
              <LinearGradient
                colors={[colors.primaryStart, colors.primaryEnd]}
                style={styles.browserGradientButton}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}>
                <Icon
                  name="open-outline"
                  size={17}
                  color="#FFFFFF"
                  style={{marginRight: 8}}
                />
                <Text style={styles.browserButtonText}>
                  Open in Google Docs
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.doneButton,
                {
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                },
              ]}>
              <Text style={[styles.doneButtonText, {color: colors.textPrimary}]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm + 4,
    borderBottomWidth: 1,
  },
  headerIconButton: {
    padding: 6,
  },
  headerTitleContainer: {
    flex: 1,
    marginHorizontal: SPACING.sm,
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16.5,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    marginTop: 1,
  },
  openDocButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  openDocText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  calloutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  calloutIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  calloutTextContainer: {
    flex: 1,
  },
  calloutTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    marginBottom: 2,
  },
  calloutSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  sectionCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    marginBottom: SPACING.sm + 4,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14.5,
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  sectionContent: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  footerContainer: {
    marginTop: SPACING.md,
  },
  browserButtonWrapper: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: 10,
  },
  browserGradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: RADIUS.lg,
  },
  browserButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14.5,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  doneButton: {
    height: 46,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
  },
});

export default LegalDocumentModal;

