import { View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export type BallTone = 'dot' | 'runs' | 'boundary' | 'wicket' | 'extra';

export interface BallChipProps {
  label: string;
  tone: BallTone;
}

/** One delivery in an over timeline: "4", "W", "wd". */
export function BallChip({ label, tone }: BallChipProps) {
  const { colors, radius } = useTheme();
  const fill: Record<BallTone, { bg: string; fg: string; border: string }> = {
    dot: { bg: colors.surface, fg: colors.textMuted, border: colors.border },
    runs: { bg: colors.surfaceMuted, fg: colors.text, border: colors.surfaceMuted },
    boundary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    wicket: { bg: colors.danger, fg: colors.textInverse, border: colors.danger },
    extra: { bg: colors.surface, fg: colors.warning, border: colors.warning },
  };
  const f = fill[tone];
  return (
    <View
      accessibilityLabel={label}
      style={{
        minWidth: 32,
        height: 32,
        paddingHorizontal: 6,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: f.border,
        backgroundColor: f.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text variant="label" style={{ color: f.fg, textTransform: 'none' }}>
        {label}
      </Text>
    </View>
  );
}
