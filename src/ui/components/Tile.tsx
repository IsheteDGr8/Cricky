import { Pressable, View } from 'react-native';

import { useTheme } from '../theme';
import { brand } from '../tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type TileTone = 'primary' | 'gold' | 'plain';

export interface TileProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  tone?: TileTone;
}

/** A big tappable action with an icon, for the main things a screen lets you do. */
export function Tile({ icon, title, subtitle, onPress, tone = 'plain' }: TileProps) {
  const { colors, spacing, radius } = useTheme();
  const bg = tone === 'primary' ? colors.primary : tone === 'gold' ? brand.gold : colors.surface;
  const fg = tone === 'primary' ? colors.onPrimary : tone === 'gold' ? brand.bar : colors.text;
  const sub =
    tone === 'primary'
      ? 'rgba(255, 255, 255, 0.75)'
      : tone === 'gold'
        ? brand.bar
        : colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        flexGrow: 1,
        flexBasis: 150,
        minHeight: 104,
        padding: spacing.lg,
        gap: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: bg,
        borderWidth: tone === 'plain' ? 1 : 0,
        borderColor: colors.border,
        boxShadow: hovered ? '0 8px 18px rgba(0, 0, 0, 0.12)' : '0 4px 10px rgba(0, 0, 0, 0.06)',
        transform: [{ translateY: hovered ? -2 : 0 }, { scale: pressed ? 0.98 : 1 }],
      })}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tone === 'plain' ? colors.primaryMuted : 'rgba(255, 255, 255, 0.18)',
        }}>
        <Icon name={icon} size={20} color={tone === 'plain' ? colors.primary : fg} />
      </View>
      <Text variant="bodyStrong" style={{ color: fg }}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="caption" style={{ color: sub }}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}
