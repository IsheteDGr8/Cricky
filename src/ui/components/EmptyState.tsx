import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export interface EmptyStateProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.xxxl,
        paddingHorizontal: spacing.xl,
      }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: radius.pill,
          backgroundColor: colors.primaryMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name={icon} size={28} color={colors.primary} accessibilityElementsHidden />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {message ? (
        <Text color="textMuted" align="center">
          {message}
        </Text>
      ) : null}
      {action}
    </View>
  );
}
