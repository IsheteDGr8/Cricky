import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Leaders,
  Loaded,
  MatchCard,
  Playoffs,
  ShareButton,
  Squads,
  Standings,
  useTournament,
  type TournamentView,
} from '@/features';
import { Card, SegmentedControl, Screen, Text, useTheme } from '@/ui';

type Section = 'standings' | 'matches' | 'playoffs' | 'stats' | 'squads';

export default function TournamentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournament = useTournament(id);

  return (
    <Screen edges={[]}>
      <Loaded value={tournament} loadingLabel="Loading tournament…">
        {(view) => <TournamentPage view={view} />}
      </Loaded>
    </Screen>
  );
}

function TournamentPage({ view }: { view: TournamentView }) {
  const [section, setSection] = useState<Section>('standings');
  const sections: { value: Section; label: string }[] = [
    { value: 'standings', label: 'Standings' },
    { value: 'matches', label: 'Matches' },
    ...(view.bracket ? [{ value: 'playoffs' as const, label: 'Playoffs' }] : []),
    { value: 'stats', label: 'Stats' },
    { value: 'squads', label: 'Squads' },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: view.tournament.name,
          headerRight: () => (
            <ShareButton path={`/tournament/${view.tournament.id}`} title={view.tournament.name} />
          ),
        }}
      />
      {view.problems.length ? (
        <Card>
          <Text color="warning">Some data could not be shown: {view.problems.join('; ')}.</Text>
        </Card>
      ) : null}
      <SegmentedControl options={sections} value={section} onChange={setSection} />
      {section === 'standings' && <Standings view={view} />}
      {section === 'matches' && <Matches view={view} />}
      {section === 'playoffs' && <Playoffs view={view} />}
      {section === 'stats' && <Leaders view={view} />}
      {section === 'squads' && <Squads view={view} />}
    </>
  );
}

function Matches({ view }: { view: TournamentView }) {
  const { spacing } = useTheme();
  if (view.matches.length === 0) return <Text color="textMuted">No matches yet.</Text>;
  return (
    <View style={{ gap: spacing.md }}>
      {view.matches.map((m) => (
        <MatchCard
          key={m.id}
          match={m}
          onPress={() => router.push({ pathname: '/match/[id]', params: { id: m.id } })}
        />
      ))}
    </View>
  );
}
