import { Pressable } from 'react-native';

import { useTheme } from '../theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  /** Small count shown after the label, e.g. live matches. */
  count?: number;
}

/** A pill for filters and single choices. Selected chips are filled purple. */
export function Chip({ label, selected = false, onPress, icon, count }: ChipProps) {
  const { colors, spacing, radius } = useTheme();
  const fg = selected ? colors.onPrimary : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        minHeight: 40,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primary : pressed ? colors.surfaceMuted : colors.surface,
      })}>
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text variant="bodyStrong" style={{ color: fg, fontSize: 14 }}>
        {label}
      </Text>
      {count !== undefined ? (
        <Text
          variant="caption"
          style={{ color: selected ? colors.onPrimary : colors.textMuted, fontWeight: '700' }}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}
