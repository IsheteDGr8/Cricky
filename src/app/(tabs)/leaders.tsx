import { useState } from 'react';

import { Leaders, Loaded, useTournament, useTournaments } from '@/features';
import { EmptyState, SegmentedControl, Screen } from '@/ui';

export default function LeadersScreen() {
  const tournaments = useTournaments();
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <Screen title="Leaders" subtitle="Top run scorers and wicket takers by tournament.">
      <Loaded value={tournaments} loadingLabel="Loading tournaments…">
        {(list) => {
          const first = list[0];
          if (!first) {
            return (
              <EmptyState
                icon="podium-outline"
                title="No stats yet"
                message="Leaderboards are calculated from completed tournament matches."
              />
            );
          }
          const id = list.some((t) => t.id === picked) ? (picked as string) : first.id;
          return (
            <>
              {list.length > 1 ? (
                <SegmentedControl
                  options={list.map((t) => ({ value: t.id, label: t.name }))}
                  value={id}
                  onChange={setPicked}
                />
              ) : null}
              <TournamentLeaders id={id} />
            </>
          );
        }}
      </Loaded>
    </Screen>
  );
}

function TournamentLeaders({ id }: { id: string }) {
  const tournament = useTournament(id);
  return (
    <Loaded value={tournament} loadingLabel="Loading stats…">
      {(view) => <Leaders view={view} limit={20} />}
    </Loaded>
  );
}
