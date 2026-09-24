import { useMemo } from 'react';

import type { Listed, MatchSnapshot, MatchSummary, WithId } from '@/data';
import { useDataLayer } from '../data-provider';
import { mapLoadable, useSubscription, type Loadable } from '../loadable';
import { buildMatchView, type MatchView } from './match-view';

/** One match, replayed from its events on every change. */
export function useMatch(id: string): Loadable<MatchView> {
  const { matches } = useDataLayer();
  const snapshot = useSubscription<MatchSnapshot>(id, (l) => matches.watch(id, l));
  return useMemo(() => mapLoadable(snapshot, buildMatchView), [snapshot]);
}

export interface MatchLists {
  live: WithId<MatchSummary>[];
  upcoming: WithId<MatchSummary>[];
  finished: WithId<MatchSummary>[];
}

/** The most recently updated matches across all tournaments, split by status. */
export function useRecentMatches(limit = 30): Loadable<MatchLists> {
  const { matches } = useDataLayer();
  const summaries = useSubscription<Listed<MatchSummary>>(`recent-${limit}`, (l) =>
    matches.watchSummaries({ recent: limit }, l),
  );
  return useMemo(
    () =>
      mapLoadable(summaries, ({ items }) => ({
        live: items.filter((m) => m.status === 'live'),
        upcoming: items.filter((m) => m.status === 'scheduled'),
        finished: items.filter((m) => m.status === 'complete'),
      })),
    [summaries],
  );
}
