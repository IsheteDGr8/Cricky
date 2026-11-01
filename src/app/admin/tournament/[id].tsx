import { useLocalSearchParams } from 'expo-router';

import { AdminGate, Loaded, TournamentControl, useTournament } from '@/features';
import { Screen } from '@/ui';

export default function AdminTournamentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournament = useTournament(id);

  return (
    <Screen>
      <AdminGate>
        <Loaded value={tournament} loadingLabel="Loading tournament…">
          {(view) => <TournamentControl view={view} />}
        </Loaded>
      </AdminGate>
    </Screen>
  );
}
