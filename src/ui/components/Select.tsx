import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { useTheme } from '../theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Second line under the label, e.g. "12 matches". */
  detail?: string;
  icon?: IconName;
}

export interface SelectProps<T extends string> {
  label: string;
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** A dropdown: shows the picked option and opens a list to choose another. */
export function Select<T extends string>({ label, options, value, onChange }: SelectProps<T>) {
  const { colors, spacing, radius } = useTheme();
  const [open, setOpen] = useState(false);
  const picked = options.find((o) => o.value === value) ?? options[0];

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${picked?.label ?? ''}. Change`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: 48,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        })}>
        {picked?.icon ? <Icon name={picked.icon} size={18} color={colors.primary} /> : null}
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="textMuted">
            {label}
          </Text>
          <Text variant="bodyStrong" numberOfLines={1}>
            {picked?.label}
          </Text>
        </View>
        <Icon name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          accessibilityLabel="Close"
          style={{
            flex: 1,
            backgroundColor: 'rgba(20, 10, 40, 0.62)',
            justifyContent: 'center',
            padding: spacing.lg,
          }}>
          <Pressable
            onPress={() => {}}
            style={{
              alignSelf: 'center',
              width: '100%',
              maxWidth: 440,
              maxHeight: '80%',
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              padding: spacing.md,
              gap: spacing.sm,
              borderWidth: 1,
              borderColor: colors.border,
              boxShadow: '0 16px 40px rgba(20, 10, 40, 0.28)',
            }}>
            <Text variant="heading" style={{ paddingHorizontal: spacing.sm }}>
              {label}
            </Text>
            <ScrollView contentContainerStyle={{ gap: spacing.xxs }}>
              {options.map((o) => {
                const selected = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      minHeight: 52,
                      paddingHorizontal: spacing.sm,
                      borderRadius: radius.md,
                      backgroundColor: selected
                        ? colors.primaryMuted
                        : pressed
                          ? colors.surfaceMuted
                          : 'transparent',
                    })}>
                    <Icon
                      name={o.icon ?? 'ellipse-outline'}
                      size={18}
                      color={selected ? colors.primary : colors.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong" color={selected ? 'primary' : 'text'}>
                        {o.label}
                      </Text>
                      {o.detail ? (
                        <Text variant="caption" color="textMuted">
                          {o.detail}
                        </Text>
                      ) : null}
                    </View>
                    {selected ? <Icon name="checkmark" size={18} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
