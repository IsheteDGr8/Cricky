import { Pressable, View } from 'react-native';

import { useTheme } from '../theme';
import { minTouchTarget } from '../tokens';
import { Icon } from './Icon';
import { Text } from './Text';

export interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** Common values shown as one-tap shortcuts. */
  presets?: readonly number[];
  unit?: string;
}

/** A number picked with − / + and quick presets instead of typing. */
export function Stepper({ label, value, onChange, min, max, presets, unit }: StepperProps) {
  const { colors, spacing, radius } = useTheme();
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const button = (delta: number) => (
    <Pressable
      onPress={() => onChange(clamp(value + delta))}
      disabled={delta < 0 ? value <= min : value >= max}
      accessibilityRole="button"
      accessibilityLabel={`${delta < 0 ? 'Fewer' : 'More'} ${label.toLowerCase()}`}
      style={({ pressed }) => ({
        width: minTouchTarget + 4,
        height: minTouchTarget + 4,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.primaryPressed : colors.primary,
        opacity: (delta < 0 ? value <= min : value >= max) ? 0.35 : 1,
      })}>
      <Icon name={delta < 0 ? 'remove' : 'add'} size={24} color={colors.onPrimary} />
    </Pressable>
  );

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label" color="textMuted">
        {label}
      </Text>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}
        accessibilityRole="adjustable"
        accessibilityValue={{ min, max, now: value }}>
        {button(-1)}
        <View style={{ minWidth: 72, alignItems: 'center' }}>
          <Text variant="display" color="primary" style={{ fontVariant: ['tabular-nums'] }}>
            {value}
          </Text>
          {unit ? (
            <Text variant="caption" color="textMuted">
              {unit}
            </Text>
          ) : null}
        </View>
        {button(1)}
      </View>
      {presets ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {presets.map((p) => (
            <Pressable
              key={p}
              onPress={() => onChange(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: p === value }}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: p === value ? colors.primary : colors.border,
                backgroundColor: p === value ? colors.primaryMuted : colors.surface,
              }}>
              <Text variant="caption" style={{ fontWeight: '700', color: colors.primary }}>
                {p}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
