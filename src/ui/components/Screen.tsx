import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { maxContentWidth } from '../tokens';
import { Text } from './Text';

export interface ScreenProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  scroll?: boolean;
  /** Tab screens sit under a header + tab bar, so only the top edge is usually needed. */
  edges?: Edge[];
}

export function Screen({ title, subtitle, children, scroll = true, edges = ['top'] }: ScreenProps) {
  const { colors, spacing } = useTheme();

  const content = (
    <View style={[styles.inner, { padding: spacing.lg, gap: spacing.lg }]}>
      {title ? (
        <View style={{ gap: spacing.xs }}>
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text color="textMuted">{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center' },
  inner: { width: '100%', maxWidth: maxContentWidth, flexGrow: 1 },
});
