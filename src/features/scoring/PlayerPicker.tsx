import { View } from 'react-native';

import { Button, Card, Text, useTheme } from '@/ui';

export interface PlayerOption {
  id: string;
  name: string;
  hint?: string;
}

/** A list of people to pick from (openers, bowler, next batter, Player of the Match). */
export function PlayerPicker({
  title,
  options,
  onPick,
  disabled,
}: {
  title: string;
  options: PlayerOption[];
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  const { spacing } = useTheme();
  return (
    <Card>
      <View style={{ gap: spacing.sm }}>
        <Text variant="heading">{title}</Text>
        {options.length === 0 ? (
          <Text color="textMuted">Nobody is available.</Text>
        ) : (
          options.map((option) => (
            <Button
              key={option.id}
              label={option.hint ? `${option.name} · ${option.hint}` : option.name}
              variant="secondary"
              fullWidth
              disabled={disabled}
              onPress={() => onPick(option.id)}
            />
          ))
        )}
      </View>
    </Card>
  );
}
