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
import {
  ColorPalette,
  DARK_COLORS,
  ThemeMode,
  getColors,
} from '../lib/theme';

const STORAGE_KEY = '@preprole_theme_mode';

export interface ThemeContextType {
  /** Currently active resolved theme palette */
  theme: ColorPalette;
  /** Alias for theme for shorthand usage: const {colors} = useTheme(); */
  colors: ColorPalette;
  /** Actual resolved mode: 'dark' or 'light' */
  mode: 'dark' | 'light';
  /** User preference setting: 'system' | 'dark' | 'light' */
  themeSetting: ThemeMode;
  /** Change the theme setting */
  setThemeSetting: (setting: ThemeMode) => Promise<void>;
  /** Convenience boolean */
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: DARK_COLORS,
  colors: DARK_COLORS,
  mode: 'dark',
  themeSetting: 'system',
  setThemeSetting: async () => {},
  isDark: true,
});

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({children}) => {
  const [themeSetting, setThemeSettingState] = useState<ThemeMode>('system');
  const [systemScheme, setSystemScheme] = useState<NonNullable<ColorSchemeName>>(
    Appearance.getColorScheme() || 'dark',
  );

  // Load persisted theme setting on mount
  useEffect(() => {
    const loadThemeSetting = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'dark' || saved === 'light' || saved === 'system') {
          setThemeSettingState(saved as ThemeMode);
        }
      } catch (err) {
        console.warn('Failed to load theme preference from storage:', err);
      }
    };
    loadThemeSetting();
  }, []);

  // Listen to system appearance changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({colorScheme}) => {
      setSystemScheme(colorScheme || 'dark');
    });
    return () => subscription.remove();
  }, []);

  // Compute resolved mode
  const resolvedMode: 'dark' | 'light' = useMemo(() => {
    if (themeSetting === 'system') {
      return systemScheme === 'light' ? 'light' : 'dark';
    }
    return themeSetting;
  }, [themeSetting, systemScheme]);

  // Active palette
  const activePalette = useMemo(() => {
    return getColors(resolvedMode);
  }, [resolvedMode]);

  // Setter with persistence
  const setThemeSetting = useCallback(async (setting: ThemeMode) => {
    try {
      console.log('🎨 [ThemeContext] Switching theme to:', setting);
      setThemeSettingState(setting);
      await AsyncStorage.setItem(STORAGE_KEY, setting);
    } catch (err) {
      console.warn('Failed to save theme preference to storage:', err);
    }
  }, []);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme: activePalette,
      colors: activePalette,
      mode: resolvedMode,
      themeSetting,
      setThemeSetting,
      isDark: resolvedMode === 'dark',
    }),
    [activePalette, resolvedMode, themeSetting, setThemeSetting],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
