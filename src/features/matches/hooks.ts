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

const splitByStatus = (items: WithId<MatchSummary>[]): MatchLists => ({
  live: items.filter((m) => m.status === 'live'),
  upcoming: items.filter((m) => m.status === 'scheduled'),
  finished: items.filter((m) => m.status === 'complete'),
});

/** The most recently updated matches across all tournaments, split by status. */
export function useRecentMatches(limit = 30): Loadable<MatchLists> {
  const { matches } = useDataLayer();
  const summaries = useSubscription<Listed<MatchSummary>>(`recent-${limit}`, (l) =>
    matches.watchSummaries({ recent: limit }, l),
  );
  return useMemo(() => mapLoadable(summaries, ({ items }) => splitByStatus(items)), [summaries]);
}

/** Which matches a list shows: everything, quick matches only, or one tournament's. */
export type MatchScope = { kind: 'all' } | { kind: 'quick' } | { kind: 'tournament'; id: string };

const ALL_LIMIT = 500;

export function scopeKey(scope: MatchScope): string {
  return scope.kind === 'tournament' ? `tournament:${scope.id}` : scope.kind;
}

/** Matches in a scope, split by status. */
export function useScopedMatches(scope: MatchScope): Loadable<MatchLists> {
  const { matches } = useDataLayer();
  const summaries = useSubscription<Listed<MatchSummary>>(`scoped-${scopeKey(scope)}`, (l) =>
    matches.watchSummaries(
      scope.kind === 'tournament' ? { tournamentId: scope.id } : { recent: ALL_LIMIT },
      l,
    ),
  );
  const quickOnly = scope.kind === 'quick';
  return useMemo(
    () =>
      mapLoadable(summaries, ({ items }) =>
        splitByStatus(quickOnly ? items.filter((m) => m.stage === 'quick') : items),
      ),
    [summaries, quickOnly],
  );
}
