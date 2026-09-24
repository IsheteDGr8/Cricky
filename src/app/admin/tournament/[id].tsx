import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  confirmAction,
  Loaded,
  parseTeamForm,
  parseTournamentForm,
  useDataLayer,
  useTournament,
  type PlayoffFormat,
  type TournamentView,
} from '@/features';
import { Button, Card, Field, Screen, SegmentedControl, Text, useTheme } from '@/ui';

export default function AdminTournamentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournament = useTournament(id);

  return (
    <Screen edges={[]}>
      <Loaded value={tournament} loadingLabel="Loading tournament…">
        {(view) => <Manage view={view} />}
      </Loaded>
    </Screen>
  );
}

function Manage({ view }: { view: TournamentView }) {
  const { spacing } = useTheme();
  const { tournaments, access, matches } = useDataLayer();
  const t = view.tournament;
  const [name, setName] = useState(t.name);
  const [overs, setOvers] = useState(String(t.oversDefault));
  const [playoffFormat, setPlayoffFormat] = useState<PlayoffFormat>(t.playoffFormat);
  const [status, setStatus] = useState(t.status);
  const [message, setMessage] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamGroup, setTeamGroup] = useState('A');
  const [teamPlayers, setTeamPlayers] = useState('');
  const [codes, setCodes] = useState<Record<string, string>>({});

  const save = async () => {
    const parsed = parseTournamentForm({
      name,
      overs,
      playoffFormat,
      thirdPlace: t.thirdPlace,
    });
    if (typeof parsed === 'string') {
      setMessage(parsed);
      return;
    }
    try {
      await tournaments.update(t.id, {
        name: parsed.name,
        oversDefault: parsed.oversDefault,
        playoffFormat: parsed.playoffFormat,
        status,
      });
      setMessage('Saved.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const addTeam = async () => {
    const parsed = parseTeamForm({
      name: teamName,
      tournamentId: t.id,
      group: teamGroup,
      players: teamPlayers,
    });
    if (typeof parsed === 'string') {
      setMessage(parsed);
      return;
    }
    try {
      await tournaments.saveTeam(parsed);
      setTeamName('');
      setTeamPlayers('');
      setMessage(`Added ${parsed.name}.`);
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const issue = async (matchId: string) => {
    try {
      const code = await access.issueScorerCode(matchId);
      setCodes((current) => ({ ...current, [matchId]: code }));
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const recordWinners = async () => {
    try {
      for (const fixture of view.bracket?.fixtures ?? []) {
        const match = view.matches.find(
          (m) =>
            m.stage === 'playoff' &&
            m.status === 'complete' &&
            samePair([m.teamA, m.teamB], [fixture.home, fixture.away]),
        );
        const winner = match?.result?.kind === 'win' ? match.result.winner : null;
        if (winner) await tournaments.setPlayoffWinner(t.id, fixture.id, winner);
      }
      setMessage('Playoff winners updated from completed matches.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <Stack.Screen options={{ title: t.name }} />
      {message ? <Text color={message.endsWith('.') ? 'success' : 'danger'}>{message}</Text> : null}

      <Card>
        <View style={{ gap: spacing.md }}>
          <Text variant="heading">Tournament</Text>
          <Field label="Name" value={name} onChangeText={setName} />
          <Field
            label="Overs a side"
            value={overs}
            onChangeText={setOvers}
            keyboardType="number-pad"
          />
          <SegmentedControl
            options={[
              { value: 'none', label: 'No playoffs' },
              { value: 'final_only', label: 'Final' },
              { value: 'top_four', label: 'Top 4' },
              { value: 'crossover', label: 'Crossover' },
            ]}
            value={playoffFormat}
            onChange={setPlayoffFormat}
          />
          <SegmentedControl
            options={[
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'active', label: 'Active' },
              { value: 'complete', label: 'Complete' },
              { value: 'archived', label: 'Archived' },
            ]}
            value={status}
            onChange={setStatus}
          />
          <Button label="Save" onPress={() => void save()} />
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.md }}>
          <Text variant="heading">Teams</Text>
          {view.teams.map((team) => (
            <View key={team.id} style={{ gap: spacing.xs }}>
              <Text variant="bodyStrong">
                {team.name} · group {team.group} · {Object.keys(team.players).length} players
              </Text>
              <Button
                label="Remove"
                variant="ghost"
                onPress={() => {
                  void (async () => {
                    if (await confirmAction('Remove team', `Delete ${team.name}?`)) {
                      await tournaments.removeTeam(team.id);
                    }
                  })();
                }}
              />
            </View>
          ))}
          <Field label="New team name" value={teamName} onChangeText={setTeamName} />
          <Field label="Group" value={teamGroup} onChangeText={setTeamGroup} />
          <Field
            label="Players (one per line, or commas)"
            value={teamPlayers}
            onChangeText={setTeamPlayers}
            multiline
          />
          <Button label="Add team" variant="secondary" onPress={() => void addTeam()} />
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.md }}>
          <Text variant="heading">Matches</Text>
          <Button
            label="Start a match"
            onPress={() =>
              router.push({ pathname: '/admin/match/new', params: { tournamentId: t.id } })
            }
          />
          {view.matches.map((m) => (
            <View key={m.id} style={{ gap: spacing.xs }}>
              <Text>
                {m.teamAName} v {m.teamBName} · {m.status}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                <Button
                  label="Open"
                  variant="ghost"
                  onPress={() => router.push({ pathname: '/match/[id]', params: { id: m.id } })}
                />
                <Button
                  label="Score"
                  variant="ghost"
                  onPress={() => router.push({ pathname: '/score/[id]', params: { id: m.id } })}
                />
                <Button
                  label={codes[m.id] ? `Code ${codes[m.id]}` : 'Issue scorer code'}
                  variant="secondary"
                  onPress={() => void issue(m.id)}
                />
                <Button
                  label="Delete"
                  variant="ghost"
                  onPress={() => {
                    void (async () => {
                      if (await confirmAction('Delete match', 'This cannot be undone.')) {
                        await matches.remove(m.id);
                      }
                    })();
                  }}
                />
              </View>
            </View>
          ))}
        </View>
      </Card>

      {view.bracket ? (
        <Card>
          <View style={{ gap: spacing.md }}>
            <Text variant="heading">Playoffs</Text>
            {view.bracket.fixtures.map((f) => (
              <Text key={f.id}>
                {f.name}: {f.home ? view.teamName(f.home) : 'TBD'} v{' '}
                {f.away ? view.teamName(f.away) : 'TBD'}
                {f.winner ? ` · ${view.teamName(f.winner)}` : ''}
              </Text>
            ))}
            <Button
              label="Record winners from results"
              variant="secondary"
              onPress={() => void recordWinners()}
            />
          </View>
        </Card>
      ) : null}

      <Button
        label="Delete tournament"
        variant="danger"
        onPress={() => {
          void (async () => {
            if (
              !(await confirmAction(
                'Delete tournament',
                'Teams go too. Matches are deleted separately.',
              ))
            ) {
              return;
            }
            await tournaments.remove(
              t.id,
              view.teams.map((team) => team.id),
            );
            router.replace('/admin' as Href);
          })();
        }}
      />
    </View>
  );
}

function samePair(a: readonly (string | null)[], b: readonly (string | null)[]): boolean {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}
