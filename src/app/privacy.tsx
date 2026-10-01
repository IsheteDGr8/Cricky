import { Linking } from 'react-native';

import { Button, Card, Screen, Text, useTheme } from '@/ui';

const ADVISORY = 'https://github.com/IsheteDGr8/Cricky/security/advisories/new';

/** Public privacy policy (also at /privacy.html on Hosting). */
export default function PrivacyScreen() {
  const { spacing } = useTheme();
  return (
    <Screen title="Privacy policy" subtitle="What Cricky stores and who can see it.">
      <Card>
        <Text color="textMuted">
          Cricky is a cricket scoring app. We store tournament, team and player names that an admin
          types in, plus ball-by-ball events. Viewers do not sign in. Admins use Google (Apple
          later). Scorers use an anonymous session and a per-match code. We do not sell data or
          collect precise location.
        </Text>
      </Card>
      <Card>
        <Text color="textMuted">
          Anyone with a link can read scores. Only scorers and admins for that match can write. To
          remove your Auth account, use Delete my account on the More tab. Past match events stay on
          the scorecard.
        </Text>
      </Card>
      <Button
        label="Report a security issue"
        variant="secondary"
        onPress={() => void Linking.openURL(ADVISORY)}
        style={{ marginTop: spacing.sm }}
      />
    </Screen>
  );
}
