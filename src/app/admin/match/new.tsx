import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Loaded,
  parseMatchForm,
  useDataLayer,
  useTournament,
  type Stage,
  type TossDecision,
  type TournamentView,
} from '@/features';
import { Button, Field, Screen, Text, useTheme } from '@/ui';

export default function NewMatchScreen() {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  const tournament = useTournament(tournamentId);
  return (
    <Screen title="Start a match">
      <Loaded value={tournament}>
        {(view) => <Form tournamentId={tournamentId} view={view} />}
      </Loaded>
    </Screen>
  );
}

function Form({ tournamentId, view }: { tournamentId: string; view: TournamentView }) {
  const { spacing } = useTheme();
  const { matches, access } = useDataLayer();
  const teams = view.teams;
  const [a, setA] = useState(teams[0]?.id ?? '');
  const [b, setB] = useState(teams[1]?.id ?? '');
  const [overs, setOvers] = useState(String(view.tournament.oversDefault));
  const [toss, setToss] = useState(teams[0]?.id ?? '');
  const [decision, setDecision] = useState<TossDecision>('bat');
  const [stage, setStage] = useState<Stage>('group');
  const [fixtureId, setFixtureId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const team = (id: string) => teams.find((t) => t.id === id);
  const asSide = (id: string) => {
    const found = team(id);
    if (!found) return null;
    return {
      id: found.id,
      name: found.name,
      players: Object.entries(found.players)
        .sort(([, x], [, y]) => x.order - y.order)
        .map(([pid, p]) => ({ id: pid, name: p.name })),
    };
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="label" color="textMuted">
        Team A
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {teams.map((t) => (
          <Button
            key={t.id}
            label={t.name}
            variant={a === t.id ? 'primary' : 'secondary'}
            onPress={() => setA(t.id)}
          />
        ))}
      </View>
      <Text variant="label" color="textMuted">
        Team B
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {teams.map((t) => (
          <Button
            key={`b-${t.id}`}
            label={t.name}
            variant={b === t.id ? 'primary' : 'secondary'}
            onPress={() => setB(t.id)}
          />
        ))}
      </View>
      <Field label="Overs" value={overs} onChangeText={setOvers} keyboardType="number-pad" />
      <Text variant="label" color="textMuted">
        Toss
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Button
          label={team(a)?.name ?? 'A'}
          variant={toss === a ? 'primary' : 'secondary'}
          onPress={() => setToss(a)}
        />
        <Button
          label={team(b)?.name ?? 'B'}
          variant={toss === b ? 'primary' : 'secondary'}
          onPress={() => setToss(b)}
        />
        <Button
          label={decision === 'bat' ? 'Chose to bat' : 'Chose to bowl'}
          variant="secondary"
          onPress={() => setDecision((d) => (d === 'bat' ? 'bowl' : 'bat'))}
        />
      </View>
      <Button
        label={stage === 'group' ? 'Stage: group' : 'Stage: playoff'}
        variant="secondary"
        onPress={() => setStage((s) => (s === 'group' ? 'playoff' : 'group'))}
      />
      {stage === 'playoff' && view.bracket
        ? view.bracket.fixtures.map((f) => (
            <Button
              key={f.id}
              label={`${f.name}${f.home && f.away ? ` · ${view.teamName(f.home)} v ${view.teamName(f.away)}` : ''}`}
              variant={fixtureId === f.id ? 'primary' : 'secondary'}
              onPress={() => {
                setFixtureId(f.id);
                if (f.home) setA(f.home);
                if (f.away) setB(f.away);
              }}
            />
          ))
        : null}
      {error ? <Text color="danger">{error}</Text> : null}
      {created ? (
        <>
          <Text variant="heading">Scorer code: {created.code}</Text>
          <Text color="textMuted">Share this code with the scorer. Anyone with it can score.</Text>
          <Button
            label="Score this match"
            onPress={() => router.replace({ pathname: '/score/[id]', params: { id: created.id } })}
          />
        </>
      ) : (
        <Button
          label="Create match"
          loading={busy}
          onPress={() => {
            const sideA = asSide(a);
            const sideB = asSide(b);
            if (!sideA || !sideB) {
              setError('Pick two teams.');
              return;
            }
            const parsed = parseMatchForm({
              teamA: sideA,
              teamB: sideB,
              overs,
              tossWinner: toss,
              tossDecision: decision,
              stage,
              tournamentId,
              fixtureId: stage === 'playoff' ? fixtureId || undefined : undefined,
            });
            if (typeof parsed === 'string') {
              setError(parsed);
              return;
            }
            setBusy(true);
            matches
              .create(parsed)
              .then(async (id) => {
                const issued = await access.issueScorerCode(id);
                setCreated({ id, code: issued });
              })
              .catch((caught: Error) => setError(caught.message))
              .finally(() => setBusy(false));
          }}
        />
      )}
    </View>
  );
}
