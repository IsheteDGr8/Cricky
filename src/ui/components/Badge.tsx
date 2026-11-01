import { View } from 'react-native';

import { useTheme } from '../theme';
import { brand } from '../tokens';
import { Text } from './Text';

/** `onHero` is for badges sitting on the purple Hero panel. */
export type BadgeTone = 'neutral' | 'live' | 'success' | 'warning' | 'brand' | 'onHero';

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
    onHero: brand.gold,
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
        backgroundColor: tone === 'onHero' ? 'rgba(255, 255, 255, 0.14)' : `${color}1A`,
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
