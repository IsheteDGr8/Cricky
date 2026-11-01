import { useEffect, useMemo, useState } from 'react';

import type { Listed, MatchResultRecord, MatchRoster } from '@/data';
import { useDataLayer } from '../data-provider';
import { useSubscription, type Loadable } from '../loadable';
import type { MatchScope } from '../matches/hooks';
import { buildStats, inScope, type StatsView } from './build-stats';

/** Rosters never change once a match is played, so each is fetched once per session. */
const rosterCache = new Map<string, MatchRoster>();
const EMPTY: MatchRoster = { teams: {}, players: {} };

/** Stats for the completed matches in a scope, with player names from each match's setup. */
export function useStats(scope: MatchScope): Loadable<StatsView> {
  const { matches } = useDataLayer();
  const results = useSubscription<Listed<MatchResultRecord>>('all-results', (l) =>
    matches.watchAllResults(l),
  );
  const [rosters, setRosters] = useState<Record<string, MatchRoster>>(() =>
    Object.fromEntries(rosterCache),
  );

  const items = useMemo(() => (results.status === 'ready' ? results.data.items : []), [results]);
  const missingKey = items
    .filter((r) => inScope(r, scope) && !(r.id in rosters))
    .map((r) => r.id)
    .join(',');

  useEffect(() => {
    if (!missingKey) return;
    let alive = true;
    void Promise.all(
      missingKey.split(',').map(async (id) => {
        const roster = await matches.getRoster(id).catch(() => EMPTY);
        rosterCache.set(id, roster);
        return [id, roster] as const;
      }),
    ).then((fetched) => {
      if (alive) setRosters((prev) => ({ ...prev, ...Object.fromEntries(fetched) }));
    });
    return () => {
      alive = false;
    };
  }, [matches, missingKey]);

  const stats = useMemo(
    () => (missingKey ? null : buildStats(items, rosters, scope)),
    [items, rosters, scope, missingKey],
  );

  if (results.status !== 'ready') return results;
  if (!stats) return { status: 'loading' };
  return { status: 'ready', data: stats };
}
