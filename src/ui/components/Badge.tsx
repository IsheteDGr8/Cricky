import { View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export type BadgeTone = 'neutral' | 'live' | 'success' | 'warning' | 'brand';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const { colors, radius, spacing } = useTheme();
  const toneColor: Record<BadgeTone, string> = {
    neutral: colors.textMuted,
    live: colors.live,
    success: colors.success,
    warning: colors.warning,
    brand: colors.primary,
  };
  const color = toneColor[tone];

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: radius.sm,
        backgroundColor: `${color}1A`,
      }}>
      {tone === 'live' && (
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      )}
      <Text variant="label" style={{ color, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}
