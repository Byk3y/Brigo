/**
 * Hook for syncing ThemeContext with NativeWind color scheme
 * Ensures components using dark: classes work correctly
 */

import { useEffect } from 'react';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import { useTheme } from '@/lib/ThemeContext';

export function useThemeSync() {
  const { themeMode } = useTheme();
  const { setColorScheme, colorScheme } = useNativeWindColorScheme();

  useEffect(() => {
    // Sync NativeWind with our theme context
    if (themeMode === 'system') {
      // @ts-ignore - NativeWind types might not explicitly include 'system' but it is supported
      setColorScheme('system');
    } else if (colorScheme !== themeMode) {
      setColorScheme(themeMode);
    }
  }, [themeMode, colorScheme, setColorScheme]);
}










