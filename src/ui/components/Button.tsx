import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { minTouchTarget } from '../tokens';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  accessibilityHint?: string;
  accessibilityLabel?: string;
  testID?: string;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  accessibilityHint,
  accessibilityLabel,
  testID,
  style,
}: ButtonProps) {
  const { colors, radius, spacing } = useTheme();
  const inactive = disabled || loading;

  const palette: Record<
    ButtonVariant,
    { bg: string; pressed: string; fg: string; border: string }
  > = {
    primary: {
      bg: colors.primary,
      pressed: colors.primaryPressed,
      fg: colors.onPrimary,
      border: colors.primary,
    },
    secondary: {
      bg: colors.surface,
      pressed: colors.surfaceMuted,
      fg: colors.text,
      border: colors.border,
    },
    ghost: {
      bg: 'transparent',
      pressed: colors.surfaceMuted,
      fg: colors.primary,
      border: 'transparent',
    },
    danger: {
      bg: colors.danger,
      pressed: colors.danger,
      fg: colors.textInverse,
      border: colors.danger,
    },
  };
  const p = palette[variant];

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: size === 'lg' ? 56 : minTouchTarget,
          paddingHorizontal: size === 'lg' ? spacing.xl : spacing.lg,
          borderRadius: radius.md,
          backgroundColor: pressed ? p.pressed : p.bg,
          borderColor: p.border,
          opacity: inactive ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={[styles.content, { gap: spacing.sm }]}>
          {icon}
          <Text variant="bodyStrong" style={{ color: p.fg }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
