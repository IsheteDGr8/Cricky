import { Pressable, View } from 'react-native';

import { useTheme } from '../theme';
import { brand } from '../tokens';
import { Icon } from './Icon';
import { Text } from './Text';

export interface StepsProps {
  labels: readonly string[];
  current: number;
  /** Lets people jump back to a step they have finished. */
  onBack?: (index: number) => void;
}

/** Progress through a short flow: done steps are gold ticks, the current one is purple. */
export function Steps({ labels, current, onBack }: StepsProps) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current + 1} of ${labels.length}: ${labels[current] ?? ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      {labels.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View
            key={label}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Pressable
              disabled={!done || !onBack}
              onPress={() => onBack?.(i)}
              accessibilityRole="button"
              accessibilityLabel={`${label}${done ? ', done' : ''}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done
                    ? brand.gold
                    : active
                      ? colors.primary
                      : colors.surfaceMuted,
                }}>
                {done ? (
                  <Icon name="checkmark" size={14} color={brand.bar} />
                ) : (
                  <Text
                    variant="caption"
                    style={{
                      fontWeight: '800',
                      color: active ? colors.onPrimary : colors.textMuted,
                    }}>
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text
                variant="caption"
                numberOfLines={1}
                style={{
                  fontWeight: active ? '800' : '600',
                  color: active ? colors.primary : colors.textMuted,
                }}>
                {label}
              </Text>
            </Pressable>
            {i < labels.length - 1 ? (
              <View
                style={{
                  flex: 1,
                  height: 2,
                  minWidth: 8,
                  borderRadius: 1,
                  backgroundColor: done ? brand.gold : colors.border,
                }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
