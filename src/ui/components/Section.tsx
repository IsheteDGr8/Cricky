import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export interface SectionProps {
  title: string;
  /** Optional link on the right, e.g. "See all". */
  action?: { label: string; onPress: () => void };
  children: ReactNode;
}

/** A titled block on a dashboard-style screen. */
export function Section({ title, action, children }: SectionProps) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text
          variant="label"
          accessibilityRole="header"
          style={{ color: colors.primary, fontWeight: '800', letterSpacing: 1 }}>
          {title}
        </Text>
        {action ? (
          <Pressable onPress={action.onPress} accessibilityRole="link" hitSlop={10}>
            <Text variant="caption" style={{ color: colors.primary, fontWeight: '700' }}>
              {action.label} ›
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}
