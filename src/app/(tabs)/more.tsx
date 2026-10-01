import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import { confirmAction, useAdminSignIn, useDataLayer, useSession } from '@/features';
import { Button, Card, Screen, Text, useTheme } from '@/ui';

export default function MoreScreen() {
  const { spacing } = useTheme();
  const { staff } = useAdminSignIn();
  const session = useSession();
  const { auth } = useDataLayer();
  const version = Constants.expoConfig?.version ?? 'dev';
  const signedIn = session.status === 'ready' && session.data !== null;

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
        <View style={{ gap: spacing.sm }}>
          <Text variant="heading">Privacy</Text>
          <Text color="textMuted">
            What we store, who can read scores, and how to remove a signed-in account.
          </Text>
          <Button
            label="Privacy policy"
            variant="secondary"
            onPress={() => router.push('/privacy' as Href)}
          />
          {signedIn ? (
            <Button
              label="Delete my account"
              variant="danger"
              onPress={() => {
                void (async () => {
                  if (
                    !(await confirmAction(
                      'Delete account',
                      'This removes your sign-in. Match scores you already entered stay on the card.',
                    ))
                  ) {
                    return;
                  }
                  await auth.deleteAccount();
                })();
              }}
            />
          ) : null}
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
