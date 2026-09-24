import { ev, firstInningsOf, makeSetup, play } from '@/domain/__fixtures__/scoring';
import type { MatchEvent } from '@/domain';
import {
  playerNames,
  toDomainEvent,
  toMatchResultRecord,
  toMatchSetup,
  toStoredEvent,
} from '../records';
import { EventRecordSchema, MatchResultRecordSchema, type MatchMeta } from '../schemas';

const meta: MatchMeta = {
  stage: 'group',
  tournamentId: 't1',
  teamA: 'A',
  teamB: 'B',
  teams: { A: { name: 'Huskies' }, B: { name: 'Eagles' } },
  players: {
    a2: { name: 'Ben', team: 'A', order: 1 },
    a1: { name: 'Asha', team: 'A', order: 0 },
    b1: { name: 'Cara', team: 'B', order: 0 },
  },
  oversPerInnings: 2,
  toss: { winner: 'B', decision: 'bowl' },
  createdAt: 1,
  createdBy: 'admin',
  locked: false,
};

const roundTrip = (event: MatchEvent, playerName?: string) => {
  const stored = { ...toStoredEvent(event, playerName), by: 'u1', at: 5 };
  // What the database would give back: JSON without undefined values.
  const parsed = EventRecordSchema.parse(JSON.parse(JSON.stringify(stored)));
  return { stored, domain: toDomainEvent(parsed) };
};

describe('event records', () => {
  it.each<MatchEvent>([
    ev.openers('a1', 'a2'),
    ev.bowler('b1'),
    ev.runs(4),
    ev.extra('wide', 2),
    ev.out('caught', 'a1', { fielder: 'b1' }),
    ev.out('stumped', 'a1', { extra: 'wide' }),
    ev.batter('a3'),
    ev.swap(),
    ev.retire('a1', 'retired_hurt'),
    ev.endInnings(),
    ev.overs(5),
    ev.potm('a1'),
    ev.potm(null),
  ])('%j survives a round trip through storage', (event) => {
    expect(roundTrip(event).domain).toEqual(event);
  });

  it('stores a new player with their name, and drops the name for the engine', () => {
    const { stored, domain } = roundTrip(ev.addPlayer('A', 'a9'), 'Zed');
    expect(stored).toMatchObject({ type: 'add_player', player: 'a9', playerName: 'Zed' });
    expect(domain).toEqual(ev.addPlayer('A', 'a9'));
  });

  it('requires a name for a new player', () => {
    expect(() => toStoredEvent(ev.addPlayer('A', 'a9'))).toThrow('A new player needs a name');
  });

  it('never stores undefined or null fields', () => {
    const stored = toStoredEvent({
      type: 'delivery',
      runs: 1,
      extra: undefined,
      wicket: undefined,
    });
    expect(stored).toEqual({ type: 'delivery', runs: 1 });
    expect(toStoredEvent(ev.potm(null))).toEqual({ type: 'set_player_of_match' });
  });
});

describe('toMatchSetup', () => {
  it('builds squads in batting-list order', () => {
    expect(toMatchSetup(meta)).toEqual({
      teamA: 'A',
      teamB: 'B',
      squads: { A: ['a1', 'a2'], B: ['b1'] },
      oversPerInnings: 2,
      toss: { winner: 'B', decision: 'bowl' },
    });
  });
});

describe('playerNames', () => {
  it('includes players added during the match', () => {
    const added = EventRecordSchema.parse({
      type: 'add_player',
      team: 'B',
      player: 'b9',
      playerName: 'Zed',
      by: 'u',
      at: 1,
    });
    expect(playerNames(meta, [added])).toEqual({ a1: 'Asha', a2: 'Ben', b1: 'Cara', b9: 'Zed' });
  });
});

describe('toMatchResultRecord', () => {
  it('produces a valid result record for a finished match', () => {
    const state = play([
      ...firstInningsOf([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      ev.endInnings(),
      ev.potm('a1'),
    ]);
    const record = toMatchResultRecord('m1', meta, state);
    expect(MatchResultRecordSchema.parse(JSON.parse(JSON.stringify(record)))).toEqual(record);
    expect(record).toMatchObject({ stage: 'group', tournamentId: 't1', playerOfMatch: 'a1' });
  });

  it('omits the tournament and Player of the Match for a quick match without one', () => {
    const state = play([ev.endInnings(), ev.endInnings()], makeSetup());
    const record = toMatchResultRecord(
      'm2',
      { ...meta, stage: 'quick', tournamentId: undefined },
      state,
    );
    expect(record).not.toHaveProperty('tournamentId');
    expect(record).not.toHaveProperty('playerOfMatch');
  });
});
