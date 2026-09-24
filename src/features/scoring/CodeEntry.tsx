import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Field, Text, useTheme } from '@/ui';
import { useRedeemCode } from './hooks';

/** Lets a scorer redeem the 10-character code for one match. */
export function CodeEntry({ matchId, onReady }: { matchId: string; onReady?: () => void }) {
  const { spacing } = useTheme();
  const { redeem, busy, error, ok } = useRedeemCode(matchId);
  const [code, setCode] = useState('');

  if (ok) {
    onReady?.();
    return null;
  }

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <Text variant="heading">Scorer code</Text>
        <Text color="textMuted">
          Ask the admin for the 10-character code for this match. You stay signed in as a guest on
          this device.
        </Text>
        <Field
          label="Code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          hint="Letters and numbers; spaces and dashes are fine."
        />
        {error ? <Text color="danger">{error}</Text> : null}
        <Button
          label="Start scoring"
          loading={busy}
          disabled={code.trim().length < 6}
          onPress={() => redeem(code)}
        />
      </View>
    </Card>
  );
}
