import { dots, ev, firstInningsOf, over } from '@/domain/__fixtures__/scoring';
import { replay, type MatchEvent } from '@/domain';
import type {
  DataLayer,
  Listed,
  Listener,
  MatchMeta,
  MatchResultRecord,
  MatchSnapshot,
  MatchSummary,
  Team,
  Tournament,
  WithId,
} from '@/data';
import { toMatchResultRecord, toMatchSetup } from '@/data/records';

const players = (team: 'A' | 'B', names: string[]) =>
  Object.fromEntries(
    names.map((name, order) => [`${team.toLowerCase()}${order + 1}`, { name, order }]),
  );

const huskies = players('A', ['Asha', 'Ben', 'Dev', 'Esa', 'Finn']);
const eagles = players('B', ['Bea', 'Bo', 'Cal', 'Dee', 'Eli']);

export const meta: MatchMeta = {
  stage: 'group',
  tournamentId: 't1',
  teamA: 'A',
  teamB: 'B',
  teams: { A: { name: 'Huskies' }, B: { name: 'Eagles' } },
  players: {
    ...Object.fromEntries(Object.entries(huskies).map(([id, p]) => [id, { ...p, team: 'A' }])),
    ...Object.fromEntries(Object.entries(eagles).map(([id, p]) => [id, { ...p, team: 'B' }])),
  },
  oversPerInnings: 2,
  toss: { winner: 'A', decision: 'bat' },
  createdAt: 1_700_000_000_000,
  createdBy: 'admin',
  locked: false,
};

/** Huskies make 12 without loss; Eagles are held to 0: Huskies win by 12 runs. */
export const completedEvents: MatchEvent[] = [
  ...firstInningsOf(Array.from({ length: 12 }, () => 1)),
  ev.openers('b1', 'b2'),
  ...over('a1', dots(6)),
  ...over('a2', dots(6)),
  ev.potm('a1'),
];

export function snapshot(events: MatchEvent[] = completedEvents, id = 'm1'): MatchSnapshot {
  const names = Object.fromEntries(Object.entries(meta.players).map(([pid, p]) => [pid, p.name]));
  return { id, meta, head: events.length, events, records: [], names };
}

export const result: WithId<MatchResultRecord> = {
  ...toMatchResultRecord('m1', meta, replay(toMatchSetup(meta), completedEvents)),
  id: 'm1',
};

export const tournament: WithId<Tournament> = {
  id: 't1',
  name: 'Summer Cup',
  status: 'active',
  oversDefault: 2,
  playoffFormat: 'final_only',
  thirdPlace: false,
  createdAt: 1_700_000_000_000,
  createdBy: 'admin',
};

export const teams: WithId<Team>[] = [
  { id: 'A', name: 'Huskies', tournamentId: 't1', group: 'A', captainId: 'a1', players: huskies },
  { id: 'B', name: 'Eagles', tournamentId: 't1', group: 'A', players: eagles },
];

export const summary = (overrides: Partial<MatchSummary> = {}): WithId<MatchSummary> => ({
  id: 'm1',
  stage: 'group',
  tournamentId: 't1',
  teamA: 'A',
  teamB: 'B',
  teamAName: 'Huskies',
  teamBName: 'Eagles',
  status: 'complete',
  updatedAt: 1_700_000_000_000,
  innings: [
    { battingTeam: 'A', runs: 12, wickets: 0, legalBalls: 12 },
    { battingTeam: 'B', runs: 0, wickets: 0, legalBalls: 12 },
  ],
  result: { kind: 'win', winner: 'A', by: 'runs', margin: 12 },
  ...overrides,
});

export const listed = <T>(items: (T & { id: string })[], invalid: string[] = []): Listed<T> => ({
  items,
  invalid,
});

/** A data layer that answers every subscription at once from fixed data. */
export function fakeDataLayer(
  data: {
    tournaments?: WithId<Tournament>[];
    teams?: WithId<Team>[];
    results?: Listed<MatchResultRecord>;
    summaries?: Listed<MatchSummary>;
    matches?: Record<string, MatchSnapshot>;
  } = {},
): DataLayer {
  const answer =
    <T>(value: () => T) =>
    (listener: Listener<T>) => {
      try {
        listener.onData(value());
      } catch (error) {
        listener.onError?.(error as Error);
      }
      return () => {};
    };
  const find = (id: string) => {
    const found = data.tournaments?.find((t) => t.id === id);
    if (!found) throw new Error(`Tournament ${id} not found`);
    return found;
  };
  const match = (id: string) => {
    const found = data.matches?.[id];
    if (!found) throw new Error(`Match ${id} not found`);
    return found;
  };
  const layer = {
    auth: {
      watchSession: (onChange: (session: null) => void) => {
        onChange(null);
        return () => {};
      },
      ensureSignedIn: async () => 'uid',
      signInWithGooglePopup: async () => {},
      signOut: async () => {},
    },
    access: {
      redeemScorerCode: async () => {},
      hasRedeemed: async () => false,
      issueScorerCode: async () => 'ABCDEFGHJK',
    },
    tournaments: {
      watchAll: (l: Listener<WithId<Tournament>[]>) => answer(() => data.tournaments ?? [])(l),
      watch: (id: string, l: Listener<WithId<Tournament>>) => answer(() => find(id))(l),
      watchTeams: (_: string, l: Listener<WithId<Team>[]>) => answer(() => data.teams ?? [])(l),
      create: async () => 't-new',
      update: async () => {},
      saveTeam: async () => 'team',
      removeTeam: async () => {},
      remove: async () => {},
      setPlayoffWinner: async () => {},
    },
    watchConnection: (l: Listener<boolean>) => answer(() => true)(l),
    matches: {
      watch: (id: string, l: Listener<MatchSnapshot>) => answer(() => match(id))(l),
      watchSummaries: (_: unknown, l: Listener<Listed<MatchSummary>>) =>
        answer(() => data.summaries ?? listed<MatchSummary>([]))(l),
      watchResults: (_: string, l: Listener<Listed<MatchResultRecord>>) =>
        answer(() => data.results ?? listed<MatchResultRecord>([]))(l),
      append: async () => {},
      undo: async () => {},
      publishSummary: async () => {},
      publishResult: async () => {},
      clearResult: async () => {},
      setLocked: async () => {},
      create: async () => 'm-new',
      remove: async () => {},
    },
  };
  return layer as unknown as DataLayer;
}
