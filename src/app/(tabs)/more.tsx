import Constants from 'expo-constants';
import { View } from 'react-native';

import { Card, Screen, Text, useTheme } from '@/ui';

export default function MoreScreen() {
  const { spacing } = useTheme();
  const version = Constants.expoConfig?.version ?? 'dev';

  return (
    <Screen title="More">
      <Card>
        <View style={{ gap: spacing.xs }}>
          <Text variant="heading">Admin & scoring</Text>
          <Text color="textMuted">
            Sign-in for admins and scorer codes arrive in a later release.
          </Text>
        </View>
      </Card>
      <Text variant="caption" color="textMuted" align="center">
        Cricky {version}
      </Text>
    </Screen>
  );
}
