import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { parseMatchRef } from '@/features';
import { Button, Field, Screen, Text, useTheme } from '@/ui';

export default function ScoreEntryScreen() {
  const { spacing } = useTheme();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen
      title="Score a match"
      subtitle="Paste the match link or type its id, then enter the code.">
      <View style={{ gap: spacing.md }}>
        <Field
          label="Match link or id"
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="cricky://match/… or /match/…"
        />
        {error ? <Text color="danger">{error}</Text> : null}
        <Button
          label="Continue"
          onPress={() => {
            const id = parseMatchRef(input);
            if (!id) {
              setError('That does not look like a match link.');
              return;
            }
            router.push({ pathname: '/score/[id]', params: { id } });
          }}
        />
      </View>
    </Screen>
  );
}
