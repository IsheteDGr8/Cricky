import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { parseTournamentForm, useDataLayer } from '@/features';
import type { PlayoffFormat } from '@/features';
import { Button, Field, Screen, SegmentedControl, Text, useTheme } from '@/ui';

const FORMATS: { value: PlayoffFormat; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'final_only', label: 'Final' },
  { value: 'top_four', label: 'Top 4' },
  { value: 'crossover', label: 'Crossover' },
];

export default function NewTournamentScreen() {
  const { spacing } = useTheme();
  const { tournaments } = useDataLayer();
  const [name, setName] = useState('');
  const [overs, setOvers] = useState('10');
  const [playoffFormat, setPlayoffFormat] = useState<PlayoffFormat>('crossover');
  const [thirdPlace, setThirdPlace] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Screen title="New tournament">
      <View style={{ gap: spacing.md }}>
        <Field label="Name" value={name} onChangeText={setName} />
        <Field
          label="Overs a side"
          value={overs}
          onChangeText={setOvers}
          keyboardType="number-pad"
        />
        <Text variant="label" color="textMuted">
          Playoffs
        </Text>
        <SegmentedControl options={FORMATS} value={playoffFormat} onChange={setPlayoffFormat} />
        {playoffFormat !== 'none' && playoffFormat !== 'final_only' ? (
          <Button
            label={thirdPlace ? '3rd-place match: on' : '3rd-place match: off'}
            variant="secondary"
            onPress={() => setThirdPlace((v) => !v)}
          />
        ) : null}
        {error ? <Text color="danger">{error}</Text> : null}
        <Button
          label="Create"
          loading={busy}
          onPress={() => {
            const parsed = parseTournamentForm({
              name,
              overs,
              playoffFormat,
              thirdPlace:
                playoffFormat === 'top_four' || playoffFormat === 'crossover' ? thirdPlace : false,
            });
            if (typeof parsed === 'string') {
              setError(parsed);
              return;
            }
            setBusy(true);
            tournaments
              .create(parsed)
              .then((id) => router.replace({ pathname: '/admin/tournament/[id]', params: { id } }))
              .catch((caught: Error) => setError(caught.message))
              .finally(() => setBusy(false));
          }}
        />
      </View>
    </Screen>
  );
}
