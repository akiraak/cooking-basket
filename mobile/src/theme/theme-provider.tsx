import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type ThemeColors } from './colors';

const ThemeContext = createContext<ThemeColors>(dark);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const colors = scheme === 'light' ? light : dark;

  return (
    <ThemeContext.Provider value={colors}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeColors(): ThemeColors {
  return useContext(ThemeContext);
}
