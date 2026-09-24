import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = 'Loading…' }: LoadingStateProps) {
  const { colors, spacing } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl }}>
      <ActivityIndicator color={colors.primary} />
      <Text color="textMuted">{label}</Text>
    </View>
  );
}
