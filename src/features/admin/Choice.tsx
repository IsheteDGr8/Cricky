import { View } from 'react-native';

import type { PlayoffFormat } from '@/data';
import { Chip, Text, useTheme } from '@/ui';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  detail: string;
}

export const PLAYOFF_FORMATS: ChoiceOption<PlayoffFormat>[] = [
  { value: 'none', label: 'League only', detail: 'Top of the table wins.' },
  { value: 'final_only', label: 'Final', detail: 'The top two meet in a final.' },
  { value: 'top_four', label: 'Top 4', detail: 'Semis 1 v 4 and 2 v 3, then a final.' },
  { value: 'crossover', label: 'Crossover', detail: 'Two groups: A1 v B2, B1 v A2, then a final.' },
];

/** Chips for a small set of options, with a line explaining the picked one. */
export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ChoiceOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { spacing } = useTheme();
  const picked = options.find((o) => o.value === value);
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label" color="textMuted">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {options.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={o.value === value}
            onPress={() => onChange(o.value)}
          />
        ))}
      </View>
      {picked ? (
        <Text variant="caption" color="textMuted">
          {picked.detail}
        </Text>
      ) : null}
    </View>
  );
}
