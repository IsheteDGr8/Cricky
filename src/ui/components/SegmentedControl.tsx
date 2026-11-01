import { Pressable, ScrollView, View } from 'react-native';

import { useTheme } from '../theme';
import { minTouchTarget } from '../tokens';
import { Text } from './Text';

export interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Full-width tabs for switching between views on one screen. Scrolls sideways when crowded. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { colors, radius } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ flexGrow: 1 }}>
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: 'row',
          flexGrow: 1,
          borderRadius: radius.sm,
          overflow: 'hidden',
          backgroundColor: '#E0E0E0',
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
                flexGrow: 1,
                minHeight: minTouchTarget,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 14,
                backgroundColor: selected ? colors.primary : 'transparent',
              }}>
              <Text variant="bodyStrong" color={selected ? 'onPrimary' : 'textMuted'}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
