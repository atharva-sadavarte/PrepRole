import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import {Appearance, ColorSchemeName} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Color Palettes ────────────────────────────────────────────────

export type ThemeMode = 'dark' | 'light' | 'system';

export interface ColorPalette {
  // Primary gradient
  primaryStart: string;
  primaryEnd: string;

  // Accent
  accent: string;
  accentLight: string;
  accentSoft: string;

  // Backgrounds
  bgDark: string;
  bgCard: string;
  bgCardLight: string;
  bgInput: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Status
  success: string;
  warning: string;
  error: string;

  // Borders
  border: string;
  borderLight: string;

  // Overlay
  overlay: string;

  // Extras for gradient backgrounds on screens
  gradientMiddle: string;
  gradientEnd: string;

  // Card shadow for light mode
  cardShadow: string;

  // Status bar style
  statusBar: 'light-content' | 'dark-content';

  // Whether this is dark mode (for conditional styling)
  isDark: boolean;
}

export const DARK_COLORS: ColorPalette = {
  // Primary brand: Warm Minimalist Accent
  primaryStart: '#C49A72',
  primaryEnd: '#A67C52',

  // Accent & Soft Accent
  accent: '#C49A72',
  accentLight: '#D9B48F',
  accentSoft: '#33291F',

  // Backgrounds
  bgDark: '#121110',
  bgCard: '#1C1A18',
  bgCardLight: '#262320',
  bgInput: '#181614',

  // Text
  textPrimary: '#F4F1EB',
  textSecondary: '#A8A39B',
  textMuted: '#706B63',

  // Status
  success: '#5B8266',
  warning: '#D9822B',
  error: '#C25953',

  // Borders
  border: '#302D29',
  borderLight: '#44403B',

  // Overlay
  overlay: 'rgba(18, 17, 16, 0.90)',

  // Gradient backgrounds
  gradientMiddle: '#161413',
  gradientEnd: '#1B1917',

  // Card shadow
  cardShadow: '#000000',

  statusBar: 'light-content',
  isDark: true,
};

export const LIGHT_COLORS: ColorPalette = {
  // Primary brand: Warm Minimalist Accent
  primaryStart: '#A67C52',
  primaryEnd: '#8E653E',

  // Accent & Soft Accent
  accent: '#A67C52',
  accentLight: '#BD946C',
  accentSoft: '#F0E5D8',

  // Backgrounds
  bgDark: '#FAF9F6',
  bgCard: '#FFFFFF',
  bgCardLight: '#F0E5D8',
  bgInput: '#FFFFFF',

  // Text
  textPrimary: '#242321',
  textSecondary: '#77736D',
  textMuted: '#A39E96',

  // Status
  success: '#4A7C59',
  warning: '#C27322',
  error: '#BA4A44',

  // Borders
  border: '#E7E3DC',
  borderLight: '#D8D3C9',

  // Overlay
  overlay: 'rgba(250, 249, 246, 0.92)',

  // Gradient backgrounds
  gradientMiddle: '#F5F3EE',
  gradientEnd: '#EFECE5',

  // Card shadow
  cardShadow: 'rgba(36, 35, 33, 0.06)',

  statusBar: 'dark-content',
  isDark: false,
};

/** Get the active palette based on mode */
export function getColors(mode: 'dark' | 'light'): ColorPalette {
  return mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;
}

/** Resolve system theme to actual mode */
export function resolveThemeMode(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'system') {
    return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
  }
  return mode;
}

// ─── Legacy alias for backwards compat during migration ────────────
export const COLORS = DARK_COLORS;

// ─── Design Tokens (theme-independent) ─────────────────────────────

export const FONTS = {
  thin: 'Montserrat-Thin',
  extraLight: 'Montserrat-ExtraLight',
  light: 'Montserrat-Light',
  regular: 'Montserrat-Regular',
  medium: 'Montserrat-Medium',
  semiBold: 'Montserrat-SemiBold',
  bold: 'Montserrat-Bold',
  extraBold: 'Montserrat-ExtraBold',
  black: 'Montserrat-Black',
  italic: 'Montserrat-Italic',
  mediumItalic: 'Montserrat-MediumItalic',
  semiBoldItalic: 'Montserrat-SemiBoldItalic',
  boldItalic: 'Montserrat-BoldItalic',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const ICON_SIZES = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  xxl: 32,
  hero: 48,
};

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  }),
  button: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
};

/** Tab bar constants with default values for backwards compatibility */
export const TAB_BAR = {
  height: 60,
  iconSize: ICON_SIZES.lg,
  labelSize: 11,
  backgroundColor: DARK_COLORS.bgCard,
  borderColor: DARK_COLORS.border,
  activeColor: DARK_COLORS.primaryStart,
  inactiveColor: DARK_COLORS.textMuted,
};



