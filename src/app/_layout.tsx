import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { DataProvider } from '@/features';
import { AppThemeProvider, buildTheme, useColorScheme } from '@/ui';

function useNavigationTheme() {
  const scheme = useColorScheme();
  const { colors } = buildTheme(scheme);
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.live,
    },
  };
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const navTheme = useNavigationTheme();

  return (
    <DataProvider>
      <AppThemeProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="match/[id]" options={{ title: 'Match' }} />
            <Stack.Screen name="tournament/[id]" options={{ title: 'Tournament' }} />
            <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
          </Stack>
        </ThemeProvider>
      </AppThemeProvider>
    </DataProvider>
  );
}
