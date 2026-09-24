import { router } from 'expo-router';

import { Loaded, TournamentCard, useTournaments } from '@/features';
import { EmptyState, Screen } from '@/ui';

export default function TournamentsScreen() {
  const tournaments = useTournaments();

  return (
    <Screen title="Tournaments" subtitle="Standings, fixtures and stats for every tournament.">
      <Loaded value={tournaments} loadingLabel="Loading tournaments…">
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              icon="trophy-outline"
              title="No tournaments yet"
              message="Tournaments appear here as soon as an admin creates one."
            />
          ) : (
            list.map((t) => (
              <TournamentCard
                key={t.id}
                tournament={t}
                onPress={() => router.push({ pathname: '/tournament/[id]', params: { id: t.id } })}
              />
            ))
          )
        }
      </Loaded>
    </Screen>
  );
}
