import { replay } from '../scoring/engine';
import type {
  DeliveryDismissalKind,
  ExtraType,
  MatchEvent,
  MatchSetup,
  PlayerId,
  TeamId,
} from '../scoring/types';

export const A: TeamId = 'A';
export const B: TeamId = 'B';

const squad = (team: string, size: number) =>
  Array.from({ length: size }, (_, i) => `${team.toLowerCase()}${i + 1}`);

/** Team A (a1..a5) bats first against Team B (b1..b5) over 2 overs, unless overridden. */
export function makeSetup(
  overrides: Partial<MatchSetup> & { squadSize?: number } = {},
): MatchSetup {
  const { squadSize = 5, ...rest } = overrides;
  return {
    teamA: A,
    teamB: B,
    squads: { [A]: squad(A, squadSize), [B]: squad(B, squadSize) },
    oversPerInnings: 2,
    toss: { winner: A, decision: 'bat' },
    ...rest,
  };
}

export const ev = {
  openers: (striker: PlayerId, nonStriker: PlayerId): MatchEvent => ({
    type: 'set_openers',
    striker,
    nonStriker,
  }),
  bowler: (bowler: PlayerId): MatchEvent => ({ type: 'set_bowler', bowler }),
  runs: (runs: number): MatchEvent => ({ type: 'delivery', runs }),
  dot: (): MatchEvent => ({ type: 'delivery', runs: 0 }),
  extra: (extra: ExtraType, runs = 0): MatchEvent => ({ type: 'delivery', runs, extra }),
  out: (
    kind: DeliveryDismissalKind,
    playerOut: PlayerId,
    opts: { runs?: number; extra?: ExtraType; fielder?: PlayerId } = {},
  ): MatchEvent => ({
    type: 'delivery',
    runs: opts.runs ?? 0,
    ...(opts.extra ? { extra: opts.extra } : {}),
    wicket: { kind, playerOut, ...(opts.fielder ? { fielder: opts.fielder } : {}) },
  }),
  batter: (batter: PlayerId): MatchEvent => ({ type: 'new_batter', batter }),
  swap: (): MatchEvent => ({ type: 'swap_strike' }),
  retire: (batter: PlayerId, kind: 'retired_hurt' | 'retired_out'): MatchEvent => ({
    type: 'retire',
    batter,
    kind,
  }),
  endInnings: (): MatchEvent => ({ type: 'end_innings' }),
  overs: (overs: number): MatchEvent => ({ type: 'set_overs', overs }),
  addPlayer: (team: TeamId, player: PlayerId): MatchEvent => ({ type: 'add_player', team, player }),
  potm: (player: PlayerId | null): MatchEvent => ({ type: 'set_player_of_match', player }),
};

export const dots = (n: number): MatchEvent[] => Array.from({ length: n }, () => ev.dot());

/** A full over of the given deliveries, preceded by choosing the bowler. */
export const over = (bowler: PlayerId, deliveries: MatchEvent[]): MatchEvent[] => [
  ev.bowler(bowler),
  ...deliveries,
];

/** Team A scores `runs` from 12 balls (2 overs) without losing a wicket; innings 1 ends. */
export function firstInningsOf(runs: number[]): MatchEvent[] {
  if (runs.length !== 12) throw new Error('firstInningsOf needs exactly 12 balls');
  return [
    ev.openers('a1', 'a2'),
    ...over('b1', runs.slice(0, 6).map(ev.runs)),
    ...over('b2', runs.slice(6).map(ev.runs)),
  ];
}

export function play(events: MatchEvent[], setup: MatchSetup = makeSetup()) {
  return replay(setup, events);
}
