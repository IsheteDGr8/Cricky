import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { DataProvider, initMonitoring } from '@/features';
import { AppThemeProvider, buildTheme, useColorScheme } from '@/ui';

initMonitoring();

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
            <Stack.Screen name="score/index" options={{ title: 'Score a match' }} />
            <Stack.Screen name="score/[id]" options={{ title: 'Score' }} />
            <Stack.Screen name="admin/index" options={{ title: 'Admin' }} />
            <Stack.Screen name="admin/tournament/new" options={{ title: 'New tournament' }} />
            <Stack.Screen name="admin/tournament/[id]" options={{ title: 'Edit tournament' }} />
            <Stack.Screen name="admin/match/new" options={{ title: 'Start a match' }} />
            <Stack.Screen name="admin/match/quick" options={{ title: 'Quick match' }} />
            <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
          </Stack>
        </ThemeProvider>
      </AppThemeProvider>
    </DataProvider>
  );
}
