import { useMemo } from 'react';

import type { Listed, MatchResultRecord, MatchSummary, Team, Tournament, WithId } from '@/data';
import { useDataLayer } from '../data-provider';
import { combine, mapLoadable, useSubscription, type Loadable } from '../loadable';
import { buildTournamentView, type TournamentView } from './tournament-view';

/** All tournaments, newest first. */
export function useTournaments(): Loadable<WithId<Tournament>[]> {
  const { tournaments } = useDataLayer();
  return useSubscription<WithId<Tournament>[]>('all', (l) => tournaments.watchAll(l));
}

/** One tournament with its standings, playoffs, matches and leaderboards, kept live. */
export function useTournament(id: string): Loadable<TournamentView> {
  const { tournaments, matches } = useDataLayer();
  const tournament = useSubscription<WithId<Tournament>>(id, (l) => tournaments.watch(id, l));
  const teams = useSubscription<WithId<Team>[]>(id, (l) => tournaments.watchTeams(id, l));
  const results = useSubscription<Listed<MatchResultRecord>>(id, (l) =>
    matches.watchResults(id, l),
  );
  const summaries = useSubscription<Listed<MatchSummary>>(id, (l) =>
    matches.watchSummaries({ tournamentId: id }, l),
  );

  return useMemo(
    () =>
      mapLoadable(combine(tournament, teams, results, summaries), (inputs) =>
        buildTournamentView(...inputs),
      ),
    [tournament, teams, results, summaries],
  );
}
