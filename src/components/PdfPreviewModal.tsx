import React, {useEffect, useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../context/ThemeContext';
import {COLORS, SPACING, RADIUS, ICON_SIZES, FONTS, SHADOWS} from '../lib/theme';
import Icon from './Icon';
import {renderPdfPages, openSystemPdfViewer, PdfPreviewResult} from '../services/pdfService';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

interface PdfPreviewModalProps {
  visible: boolean;
  fileUri: string | null;
  fileName?: string;
  fileSize?: number;
  onClose: () => void;
  onReplaceFile?: () => void;
  onConfirmFile?: () => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  visible,
  fileUri,
  fileName = 'Resume Document',
  fileSize,
  onClose,
  onReplaceFile,
  onConfirmFile,
}) => {
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [pageWidths, setPageWidths] = useState<number[]>([]);
  const [pageHeights, setPageHeights] = useState<number[]>([]);
  const [totalPageCount, setTotalPageCount] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const lastTapRef = useRef<number>(0);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(2.5, +(prev + 0.25).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(0.75, +(prev - 0.25).toFixed(2)));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setZoomLevel(prev => (prev > 1.1 ? 1 : 1.5));
    }
    lastTapRef.current = now;
  };

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  useEffect(() => {
    if (!visible || !fileUri) {
      setPages([]);
      setError(null);
      setLoading(true);
      setZoomLevel(1);
      return;
    }

    let isMounted = true;

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        const result: PdfPreviewResult = await renderPdfPages(fileUri, 6);
        if (isMounted) {
          if (result.pageUris && result.pageUris.length > 0) {
            setPages(result.pageUris);
            setPageWidths(result.pageWidths || []);
            setPageHeights(result.pageHeights || []);
            setTotalPageCount(result.pageCount || result.pageUris.length);
          } else {
            setError('No preview pages could be rendered.');
          }
        }
      } catch (err: any) {
        console.warn('In-app PDF rendering error:', err);
        if (isMounted) {
          setError(err?.message || 'Could not render PDF preview in-app.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
    };
  }, [visible, fileUri, fadeAnim]);

  const handleOpenExternal = async () => {
    if (!fileUri) return;
    await openSystemPdfViewer(fileUri);
  };

  if (!visible) return null;

  const baseWidth = SCREEN_WIDTH - SPACING.lg * 2;
  const scaledWidth = baseWidth * zoomLevel;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: isDark
              ? 'rgba(10, 9, 8, 0.96)'
              : 'rgba(250, 249, 246, 0.97)',
            paddingTop: Math.max(insets.top, StatusBar.currentHeight || 0),
          },
        ]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        {/* Top Stationary Header Bar */}
        <View
          style={[
            styles.headerBar,
            {
              backgroundColor: colors.bgDark,
              borderBottomColor: colors.border,
            },
          ]}>
          <View style={styles.headerLeft}>
            <View
              style={[
                styles.docIconPill,
                {
                  backgroundColor: colors.accentSoft,
                  borderColor: colors.border,
                },
              ]}>
              <Icon name="document-text" size={16} color={colors.accent} />
            </View>
            <View style={styles.headerInfo}>
              <Text
                style={[styles.headerTitle, {color: colors.textPrimary}]}
                numberOfLines={1}
                ellipsizeMode="middle">
                {fileName}
              </Text>
              <Text style={[styles.headerMeta, {color: colors.textSecondary}]}>
                {fileSize ? `${formatFileSize(fileSize)} • ` : ''}
                {totalPageCount} {totalPageCount === 1 ? 'Page' : 'Pages'}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={handleOpenExternal}
              style={[
                styles.iconBtn,
                {backgroundColor: colors.bgCard, borderColor: colors.border},
              ]}
              activeOpacity={0.7}
              accessibilityLabel="Open in system viewer">
              <Icon name="open-outline" size={16} color={colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.iconBtn,
                {backgroundColor: colors.bgCard, borderColor: colors.border},
              ]}
              activeOpacity={0.7}
              accessibilityLabel="Close preview">
              <Icon name="close" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Preview Container */}
        <View style={styles.previewContainer}>
          {loading ? (
            <View style={styles.centeredState}>
              <View
                style={[
                  styles.loadingCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    ...SHADOWS.card,
                  },
                ]}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={[styles.loadingTitle, {color: colors.textPrimary}]}>
                  Rendering Resume Preview
                </Text>
                <Text style={[styles.loadingSub, {color: colors.textSecondary}]}>
                  Generating high-resolution page render directly from device...
                </Text>
              </View>
            </View>
          ) : error ? (
            <View style={styles.centeredState}>
              <View
                style={[
                  styles.errorCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    ...SHADOWS.card,
                  },
                ]}>
                <View
                  style={[
                    styles.errorIconCircle,
                    {
                      backgroundColor: isDark
                        ? 'rgba(239, 68, 68, 0.12)'
                        : 'rgba(220, 38, 38, 0.08)',
                    },
                  ]}>
                  <Icon name="alert-circle-outline" size={32} color={colors.error} />
                </View>
                <Text style={[styles.errorTitle, {color: colors.textPrimary}]}>
                  Preview Unavailable
                </Text>
                <Text style={[styles.errorSub, {color: colors.textSecondary}]}>
                  {error}
                </Text>
                <TouchableOpacity
                  style={[styles.systemViewerBtn, {backgroundColor: colors.accent}]}
                  onPress={handleOpenExternal}
                  activeOpacity={0.8}>
                  <Icon
                    name="open-outline"
                    size={16}
                    color="#FFFFFF"
                    style={{marginRight: 6}}
                  />
                  <Text style={styles.systemViewerBtnText}>
                    Open in System PDF Viewer
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[
                styles.horizontalScrollContent,
                {minWidth: SCREEN_WIDTH},
              ]}>
              <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={[
                  styles.scrollContent,
                  {minWidth: Math.max(SCREEN_WIDTH, scaledWidth + SPACING.lg * 2)},
                ]}
                showsVerticalScrollIndicator={true}>
                {pages.map((pageUri, index) => {
                  const pWidth = pageWidths[index] || 1;
                  const pHeight = pageHeights[index] || 1.414; // Default A4 ratio
                  const pageAspect = pHeight / pWidth;
                  const displayHeight = scaledWidth * pageAspect;

                  return (
                    <TouchableOpacity
                      key={`page-${index}`}
                      activeOpacity={0.96}
                      onPress={handleDoubleTap}
                      style={styles.pageWrapper}>
                      <View
                        style={[
                          styles.pageCard,
                          {
                            width: scaledWidth,
                            height: displayHeight,
                            borderColor: colors.border,
                            ...SHADOWS.elevated,
                          },
                        ]}>
                        <Image
                          source={{uri: pageUri}}
                          style={styles.pageImage}
                          resizeMode="contain"
                        />
                      </View>
                      <View style={styles.pageNumberBadge}>
                        <Text
                          style={[
                            styles.pageNumberText,
                            {color: colors.textSecondary},
                          ]}>
                          Page {index + 1} of {totalPageCount}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </ScrollView>
          )}
        </View>

        {/* Floating Zoom Controls Capsule */}
        {!loading && !error && pages.length > 0 && (
          <View
            style={[
              styles.zoomWidgetContainer,
              {
                bottom:
                  (Platform.OS === 'android'
                    ? Math.max(insets.bottom, 48) + 14
                    : Math.max(insets.bottom, SPACING.lg)) + 62,
              },
            ]}>
            <View
              style={[
                styles.zoomCapsule,
                {
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                  ...SHADOWS.elevated,
                },
              ]}>
              <TouchableOpacity
                style={styles.zoomBtn}
                onPress={handleZoomOut}
                disabled={zoomLevel <= 0.75}
                activeOpacity={0.7}
                accessibilityLabel="Zoom out">
                <Icon
                  name="remove"
                  size={16}
                  color={
                    zoomLevel <= 0.75
                      ? colors.textMuted
                      : colors.textPrimary
                  }
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.zoomPercentBtn}
                onPress={handleResetZoom}
                activeOpacity={0.7}
                accessibilityLabel="Reset zoom">
                <Text
                  style={[
                    styles.zoomPercentText,
                    {color: colors.textPrimary},
                  ]}>
                  {Math.round(zoomLevel * 100)}%
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.zoomBtn}
                onPress={handleZoomIn}
                disabled={zoomLevel >= 2.5}
                activeOpacity={0.7}
                accessibilityLabel="Zoom in">
                <Icon
                  name="add"
                  size={16}
                  color={
                    zoomLevel >= 2.5 ? colors.textMuted : colors.textPrimary
                  }
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom Floating Action Bar */}
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.bgDark,
              borderTopColor: colors.border,
              paddingBottom:
                Platform.OS === 'android'
                  ? Math.max(insets.bottom, 48) + 14
                  : Math.max(insets.bottom, SPACING.lg),
            },
          ]}>
          {onReplaceFile && (
            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                {
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => {
                onClose();
                onReplaceFile();
              }}
              activeOpacity={0.8}>
              <Icon
                name="swap-horizontal-outline"
                size={16}
                color={colors.textPrimary}
                style={{marginRight: 6}}
              />
              <Text
                style={[styles.secondaryBtnText, {color: colors.textPrimary}]}>
                Change File
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              {
                backgroundColor: colors.accent,
                flex: onReplaceFile ? 1 : undefined,
                minWidth: onReplaceFile ? undefined : 180,
              },
            ]}
            onPress={() => {
              if (onConfirmFile) {
                onConfirmFile();
              }
              onClose();
            }}
            activeOpacity={0.85}>
            <Icon
              name="checkmark-circle-outline"
              size={18}
              color={isDark ? '#121110' : '#FFFFFF'}
              style={{marginRight: 6}}
            />
            <Text
              style={[
                styles.primaryBtnText,
                {color: isDark ? '#121110' : '#FFFFFF'},
              ]}>
              Looks Good
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  headerBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
  },
  docIconPill: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    letterSpacing: -0.2,
  },
  headerMeta: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: SPACING.lg,
    paddingBottom: 150,
    alignItems: 'center',
  },
  pageWrapper: {
    marginBottom: SPACING.xl,
    alignItems: 'center',
  },
  pageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pageImage: {
    width: '100%',
    height: '100%',
  },
  pageNumberBadge: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  pageNumberText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  loadingCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  loadingTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  loadingSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  errorCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  errorIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  errorTitle: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    marginBottom: SPACING.xs,
  },
  errorSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  systemViewerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
  },
  systemViewerBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  bottomBar: {
    paddingTop: SPACING.md,
    paddingBottom: Platform.OS === 'android' ? 24 : SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    borderTopWidth: 1,
    gap: SPACING.sm,
  },
  secondaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  primaryBtn: {
    height: 46,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  primaryBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  horizontalScrollContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomWidgetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99,
  },
  zoomCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: 6,
    elevation: 8,
  },
  zoomBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomPercentBtn: {
    paddingHorizontal: SPACING.sm,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomPercentText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    letterSpacing: 0.3,
  },
});

export default PdfPreviewModal;
