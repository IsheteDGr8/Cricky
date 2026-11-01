import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  AdminGate,
  Choice,
  parseTournamentForm,
  PLAYOFF_FORMATS,
  useDataLayer,
  type PlayoffFormat,
} from '@/features';
import { Button, Card, Chip, Field, Hero, onHero, Screen, Stepper, Text, useTheme } from '@/ui';

export default function NewTournamentScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'New tournament' }} />
      <AdminGate>
        <Form />
      </AdminGate>
    </Screen>
  );
}

function Form() {
  const { spacing } = useTheme();
  const { tournaments } = useDataLayer();
  const [name, setName] = useState('');
  const [overs, setOvers] = useState(10);
  const [playoffFormat, setPlayoffFormat] = useState<PlayoffFormat>('crossover');
  const [thirdPlace, setThirdPlace] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const semis = playoffFormat === 'top_four' || playoffFormat === 'crossover';

  const create = () => {
    const parsed = parseTournamentForm({
      name,
      overs: String(overs),
      playoffFormat,
      thirdPlace: semis ? thirdPlace : false,
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
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <Hero>
        <Text variant="title" style={{ color: onHero.strong }}>
          {name.trim() || 'Your tournament'}
        </Text>
        <Text style={{ color: onHero.soft }}>
          Three choices and you are done. You add teams and start matches in the control room next.
        </Text>
      </Hero>
      <Card>
        <View style={{ gap: spacing.lg }}>
          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Fall Smash 2026"
            autoFocus
          />
          <Stepper
            label="Overs a side"
            value={overs}
            onChange={setOvers}
            min={1}
            max={50}
            presets={[5, 6, 8, 10, 12, 20]}
            unit="overs"
          />
          <Choice
            label="Playoffs"
            options={PLAYOFF_FORMATS}
            value={playoffFormat}
            onChange={setPlayoffFormat}
          />
          {semis ? (
            <Chip
              label="Play a 3rd-place match"
              icon="medal-outline"
              selected={thirdPlace}
              onPress={() => setThirdPlace((v) => !v)}
            />
          ) : null}
          <Text variant="caption" color="textMuted">
            You can change any of these later in Settings.
          </Text>
        </View>
      </Card>
      {error ? <Text color="danger">{error}</Text> : null}
      <Button label="Create tournament" variant="gold" size="lg" loading={busy} onPress={create} />
    </View>
  );
}
