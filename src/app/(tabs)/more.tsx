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
          <Text color="textMuted">Scorer codes and admin sign-in arrive in the next releases.</Text>
        </View>
      </Card>
      <Card>
        <View style={{ gap: spacing.xs }}>
          <Text variant="heading">Sharing</Text>
          <Text color="textMuted">
            Every match and tournament has its own link. Use Share on its page to send it; anyone
            can follow along without signing in.
          </Text>
        </View>
      </Card>
      <Text variant="caption" color="textMuted" align="center">
        Cricky {version}
      </Text>
    </Screen>
  );
}
