/**
 * Theme Context - Provides dark mode state to all components
 * Simple implementation using React Native's useColorScheme hook
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useStore } from '@/lib/store';
import { theme } from '@/lib/theme';

interface ThemeContextValue {
  isDarkMode: boolean;
  effectiveColorScheme: 'light' | 'dark';
  themeMode: 'system' | 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue>({
  isDarkMode: false,
  effectiveColorScheme: 'light',
  themeMode: 'system',
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { themeMode } = useStore();
  const systemColorScheme = useColorScheme();

  const value = useMemo(() => {
    const currentThemeMode = themeMode ?? 'system';
    const effectiveColorScheme = currentThemeMode === 'system'
      ? (systemColorScheme ?? 'light')
      : currentThemeMode;
    const isDarkMode = effectiveColorScheme === 'dark';

    return {
      isDarkMode,
      effectiveColorScheme: effectiveColorScheme as 'light' | 'dark',
      themeMode: currentThemeMode,
    };
  }, [themeMode, systemColorScheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Helper function to get theme-aware colors
 * Use this in components that need inline styles
 * Styled to match NotebookLM's sophisticated aesthetic
 */
export const getThemeColors = (isDark: boolean) => ({
  // Backgrounds - soft off-white for light, muted gray for dark
  background: isDark ? '#29292b' : '#faf9f6',
  surface: isDark ? '#2f2f31' : '#f5f4f1',
  surfaceAlt: isDark ? '#353537' : '#efeee9',
  surfaceElevated: isDark ? '#323234' : '#FFFFFF',

  // Text
  text: isDark ? '#E8E8E8' : '#1a1a1a',
  textSecondary: isDark ? '#A0A0A0' : '#5c5c5c',
  textMuted: isDark ? '#707070' : '#8a8a8a',

  // Borders
  border: isDark ? '#404042' : '#e5e4df',
  borderLight: isDark ? '#353537' : '#efeee9',

  // Icons
  icon: isDark ? '#E8E8E8' : '#1a1a1a',
  iconMuted: isDark ? '#808080' : '#6B7280',

  // Card backgrounds for Studio items
  cardAudio: isDark ? '#2a3342' : '#eef3fc',
  cardFlashcard: isDark ? '#3a2f2f' : '#fcefef',
  cardQuiz: isDark ? '#2a3a3a' : '#eef8f4',
  cardPrediction: isDark ? '#3a2a3a' : '#f8eef8', // Purple/violet for predictions

  // Generated media card
  mediaCard: isDark ? '#2f2f31' : '#FFFFFF',
  mediaCardBorder: isDark ? '#3a3a3c' : '#e5e4df',

  // Brand colors (from theme.ts)
  primary: theme.colors.primary.DEFAULT,
  primaryLight: theme.colors.primary[400],
  primaryDark: theme.colors.primary[600],
  accent: theme.colors.accent.DEFAULT,
  success: theme.colors.success,
  error: theme.colors.error,
  neutral: {
    light: theme.colors.neutral[300],
    DEFAULT: theme.colors.neutral.DEFAULT,
    dark: theme.colors.neutral[800],
  },
  // Common UI colors
  white: '#FFFFFF',
  black: '#000000',
  shadowColor: '#000',
  shadowOpacity: isDark ? 0.4 : 0.1,
});

/**
 * Helper function to get theme-aware shadows
 */
export const getThemeShadows = (isDark: boolean) => ({
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.4 : 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.5 : 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
});




















