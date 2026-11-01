import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
  testID?: string;
}

export function Card({ children, onPress, accessibilityLabel, style, testID }: CardProps) {
  const { colors, radius, spacing } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: onPress ? 44 : undefined,
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.06)',
  };

  if (!onPress) {
    return (
      <View testID={testID} style={[base, style]}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        base,
        hovered && { boxShadow: '0 6px 15px rgba(0, 0, 0, 0.1)', transform: [{ translateY: -2 }] },
        pressed && { backgroundColor: colors.surfaceMuted },
        style,
      ]}>
      {children}
    </Pressable>
  );
}
