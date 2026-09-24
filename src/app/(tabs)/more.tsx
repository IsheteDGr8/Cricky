import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import { useAdminSignIn } from '@/features';
import { Button, Card, Screen, Text, useTheme } from '@/ui';

export default function MoreScreen() {
  const { spacing } = useTheme();
  const { staff } = useAdminSignIn();
  const version = Constants.expoConfig?.version ?? 'dev';

  return (
    <Screen title="More">
      <Card>
        <View style={{ gap: spacing.sm }}>
          <Text variant="heading">Score a match</Text>
          <Text color="textMuted">
            Paste the match link and the 10-character code the admin gave you. You do not need an
            account.
          </Text>
          <Button label="Enter scorer code" onPress={() => router.push('/score' as Href)} />
        </View>
      </Card>
      <Card>
        <View style={{ gap: spacing.sm }}>
          <Text variant="heading">Admin</Text>
          <Text color="textMuted">
            Sign in with Google to create tournaments, teams, fixtures and scorer codes.
          </Text>
          <Button
            label={staff ? 'Open admin' : 'Admin sign-in'}
            variant="secondary"
            onPress={() => router.push('/admin' as Href)}
          />
        </View>
      </Card>
      <Card>
        <View style={{ gap: spacing.xs }}>
          <Text variant="heading">Sharing</Text>
          <Text color="textMuted">
            Every match and tournament has its own link. Use Share on its page to send it; anyone
            can follow along without signing in. On a phone the same links open this app.
          </Text>
        </View>
      </Card>
      <Text variant="caption" color="textMuted" align="center">
        Cricky {version}
      </Text>
    </Screen>
  );
}
