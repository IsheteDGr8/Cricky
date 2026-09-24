import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { parseMatchForm, parseQuickTeams, useDataLayer, type TossDecision } from '@/features';
import { Button, Field, Screen, Text, useTheme } from '@/ui';

export default function QuickMatchScreen() {
  const { spacing } = useTheme();
  const { matches, access } = useDataLayer();
  const [aName, setAName] = useState('');
  const [bName, setBName] = useState('');
  const [aPlayers, setAPlayers] = useState('');
  const [bPlayers, setBPlayers] = useState('');
  const [overs, setOvers] = useState('10');
  const [decision, setDecision] = useState<TossDecision>('bat');
  const [aWonToss, setAWonToss] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Screen
      title="Quick match"
      subtitle="Typed teams for one game. They are not saved as tournament squads.">
      <View style={{ gap: spacing.md }}>
        <Field label="Team A" value={aName} onChangeText={setAName} />
        <Field
          label="Team A players (one per line)"
          value={aPlayers}
          onChangeText={setAPlayers}
          multiline
        />
        <Field label="Team B" value={bName} onChangeText={setBName} />
        <Field
          label="Team B players (one per line)"
          value={bPlayers}
          onChangeText={setBPlayers}
          multiline
        />
        <Field label="Overs" value={overs} onChangeText={setOvers} keyboardType="number-pad" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button
            label={`${aName || 'A'} won toss`}
            variant={aWonToss ? 'primary' : 'secondary'}
            onPress={() => setAWonToss(true)}
          />
          <Button
            label={`${bName || 'B'} won toss`}
            variant={!aWonToss ? 'primary' : 'secondary'}
            onPress={() => setAWonToss(false)}
          />
          <Button
            label={decision === 'bat' ? 'Chose to bat' : 'Chose to bowl'}
            variant="secondary"
            onPress={() => setDecision((d) => (d === 'bat' ? 'bowl' : 'bat'))}
          />
        </View>
        {error ? <Text color="danger">{error}</Text> : null}
        {created ? (
          <>
            <Text variant="heading">Scorer code: {created.code}</Text>
            <Button
              label="Score this match"
              onPress={() =>
                router.replace({ pathname: '/score/[id]', params: { id: created.id } })
              }
            />
          </>
        ) : (
          <Button
            label="Start"
            loading={busy}
            onPress={() => {
              const sides = parseQuickTeams(aName, aPlayers, bName, bPlayers);
              if (typeof sides === 'string') {
                setError(sides);
                return;
              }
              const [teamA, teamB] = sides;
              const parsed = parseMatchForm({
                teamA,
                teamB,
                overs,
                tossWinner: aWonToss ? teamA.id : teamB.id,
                tossDecision: decision,
                stage: 'quick',
              });
              if (typeof parsed === 'string') {
                setError(parsed);
                return;
              }
              setBusy(true);
              matches
                .create(parsed)
                .then(async (id) => setCreated({ id, code: await access.issueScorerCode(id) }))
                .catch((caught: Error) => setError(caught.message))
                .finally(() => setBusy(false));
            }}
          />
        )}
      </View>
    </Screen>
  );
}
