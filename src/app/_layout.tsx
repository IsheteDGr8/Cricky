import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { DataProvider, initMonitoring, useLegacyMatchRedirect } from '@/features';
import { AppThemeProvider, brand, buildTheme } from '@/ui';

initMonitoring();

const { colors } = buildTheme('light');

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.live,
  },
};

export default function RootLayout() {
  useLegacyMatchRedirect();

  return (
    <DataProvider>
      <AppThemeProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: brand.bar },
              headerTintColor: '#FFFFFF',
              headerTitleStyle: { fontWeight: '700' },
              headerShadowVisible: false,
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="match/[id]" options={{ title: 'Match' }} />
            <Stack.Screen name="tournament/[id]" options={{ title: 'Tournament' }} />
            <Stack.Screen name="score/[id]" options={{ title: 'Score' }} />
            <Stack.Screen name="admin/index" options={{ title: 'Admin' }} />
            <Stack.Screen name="admin/tournament/new" options={{ title: 'New tournament' }} />
            <Stack.Screen name="admin/tournament/[id]" options={{ title: 'Control room' }} />
            <Stack.Screen name="admin/match/new" options={{ title: 'Start a match' }} />
            <Stack.Screen name="admin/match/quick" options={{ title: 'Quick match' }} />
            <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
            <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
          </Stack>
        </ThemeProvider>
      </AppThemeProvider>
    </DataProvider>
  );
}
