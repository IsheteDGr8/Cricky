import { Stack, useLocalSearchParams } from 'expo-router';

import { AdminGate, Loaded, MatchWizard, useTournament } from '@/features';
import { Screen } from '@/ui';

export default function NewMatchScreen() {
  const { tournamentId, fixtureId } = useLocalSearchParams<{
    tournamentId: string;
    fixtureId?: string;
  }>();
  const tournament = useTournament(tournamentId);
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Start a match' }} />
      <AdminGate>
        <Loaded value={tournament}>
          {(view) => <MatchWizard mode="tournament" view={view} fixtureId={fixtureId} />}
        </Loaded>
      </AdminGate>
    </Screen>
  );
}
