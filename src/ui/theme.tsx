import { createContext, useContext, type ReactNode } from 'react';

import {
  colors,
  fonts,
  radius,
  spacing,
  typography,
  type ColorScheme,
  type ThemeColors,
} from './tokens';
import { useColorScheme } from './use-color-scheme';

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  fonts: typeof fonts;
}

export function buildTheme(scheme: ColorScheme): Theme {
  return { scheme, colors: colors[scheme], spacing, radius, typography, fonts };
}

const ThemeContext = createContext<Theme>(buildTheme('light'));

export function AppThemeProvider({
  children,
  scheme: forcedScheme,
}: {
  children: ReactNode;
  scheme?: ColorScheme;
}) {
  const systemScheme = useColorScheme();
  const theme = buildTheme(forcedScheme ?? systemScheme);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
