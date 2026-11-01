import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { brand } from '../tokens';

/** The purple gradient panel used for headline content (live scores, greetings). */
export function Hero({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={[
        {
          borderRadius: radius.lg,
          overflow: 'hidden',
          padding: spacing.lg,
          gap: spacing.md,
          backgroundColor: colors.primary,
          experimental_backgroundImage: `linear-gradient(135deg, ${colors.primary}, ${brand.bar})`,
          boxShadow: '0 10px 24px rgba(75, 46, 131, 0.28)',
        },
        style,
      ]}>
      {children}
    </View>
  );
}

/** White text tones for content on a Hero. */
export const onHero = {
  strong: '#FFFFFF',
  soft: 'rgba(255, 255, 255, 0.75)',
  faint: 'rgba(255, 255, 255, 0.15)',
} as const;
