import { Platform } from 'react-native';

/** Raw palette. Components should use semantic colors from the theme, not these directly. */
export const palette = {
  purple50: '#F3F0F9',
  purple100: '#E3DCF1',
  purple300: '#9E86CC',
  purple500: '#4B2E83',
  purple600: '#3E2570',
  purple700: '#2F1C56',
  gold300: '#D9CCA6',
  gold500: '#B7A57A',
  gold700: '#85764F',
  gray0: '#FFFFFF',
  gray50: '#F7F7F9',
  gray100: '#EEEEF2',
  gray200: '#E0E0E6',
  gray400: '#9A9AA6',
  gray600: '#5E5E6B',
  gray800: '#26262E',
  gray900: '#17171C',
  gray950: '#0E0E12',
  green500: '#2E7D32',
  green400: '#4CAF50',
  red500: '#D32F2F',
  red400: '#EF5350',
  amber500: '#ED9B00',
  blue500: '#1E6FD9',
} as const;

export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  primaryMuted: string;
  accent: string;
  onAccent: string;
  success: string;
  danger: string;
  warning: string;
  info: string;
  live: string;
}

export const colors: Record<ColorScheme, ThemeColors> = {
  light: {
    background: palette.gray50,
    surface: palette.gray0,
    surfaceMuted: palette.gray100,
    border: palette.gray200,
    text: palette.gray900,
    textMuted: palette.gray600,
    textInverse: palette.gray0,
    primary: palette.purple500,
    primaryPressed: palette.purple600,
    onPrimary: palette.gray0,
    primaryMuted: palette.purple50,
    accent: palette.gold500,
    onAccent: palette.gray950,
    success: palette.green500,
    danger: palette.red500,
    warning: palette.amber500,
    info: palette.blue500,
    live: palette.red500,
  },
  dark: {
    background: palette.gray950,
    surface: palette.gray900,
    surfaceMuted: palette.gray800,
    border: palette.gray800,
    text: palette.gray50,
    textMuted: palette.gray400,
    textInverse: palette.gray950,
    primary: palette.purple300,
    primaryPressed: palette.purple100,
    onPrimary: palette.gray950,
    primaryMuted: palette.purple700,
    accent: palette.gold300,
    onAccent: palette.gray950,
    success: palette.green400,
    danger: palette.red400,
    warning: palette.amber500,
    info: palette.blue500,
    live: palette.red400,
  },
};

/** 4-point spacing scale. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

const fontFamily = Platform.select({
  ios: { regular: 'System', mono: 'Menlo' },
  android: { regular: 'sans-serif', mono: 'monospace' },
  default: {
    regular: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
});

export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.4 },
  score: { fontSize: 40, lineHeight: 46, fontWeight: '700', fontVariant: ['tabular-nums'] },
} as const;

export type TypographyVariant = keyof typeof typography;

export const fonts = fontFamily;

/** Minimum touch target (Apple HIG 44pt, Material 48dp). */
export const minTouchTarget = 44;

export const maxContentWidth = 720;
