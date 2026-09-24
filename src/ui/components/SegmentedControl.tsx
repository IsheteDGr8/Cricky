import { Pressable, ScrollView, View } from 'react-native';

import { useTheme } from '../theme';
import { minTouchTarget } from '../tokens';
import { Text } from './Text';

export interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** A row of tabs for switching between views on one screen. Scrolls sideways when crowded. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { colors, radius, spacing } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: 'row',
          gap: spacing.xs,
          padding: spacing.xs,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceMuted,
        }}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={{
                minHeight: minTouchTarget - spacing.sm,
                justifyContent: 'center',
                paddingHorizontal: spacing.md,
                borderRadius: radius.sm,
                backgroundColor: selected ? colors.surface : 'transparent',
              }}>
              <Text variant="bodyStrong" color={selected ? 'primary' : 'textMuted'}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
