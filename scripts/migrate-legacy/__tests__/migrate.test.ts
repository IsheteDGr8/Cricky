import { replay } from '@/domain';
import { toDomainEvent, toMatchSetup } from '@/data/records';
import { MatchMetaSchema } from '@/data/schemas';
import { ids, legacyBackup, MATCH_TIME, pushId } from '../__fixtures__/backup';
import { pushIdTime } from '../legacy';
import { migrateBackup } from '../migrate';

const migrate = (backup: unknown = legacyBackup()) =>
  migrateBackup(backup, { migratedBy: 'v1-migration' });

type Backup = ReturnType<typeof legacyBackup>;
const edit = (change: (backup: Backup) => void): Backup => {
  const backup = legacyBackup();
  change(backup);
  return backup;
};
const match = (backup: Backup) => backup.matches[ids.match] as Backup['matches'][string];

describe('migrateBackup', () => {
  it('reproduces a v1 match exactly, ball by ball', () => {
    const { database, report } = migrate();
    expect(report.notes).toEqual([]);
    expect(report.matches).toEqual([
      expect.objectContaining({ id: ids.match, outcome: 'exact', notes: [], adjustments: [] }),
    ]);

    const stored = database.matches[ids.match];
    if (!stored) throw new Error('match not migrated');
    expect(MatchMetaSchema.parse(stored.meta)).toMatchObject({
      stage: 'group',
      tournamentId: 'default',
      locked: true,
      toss: { winner: ids.huskies, decision: 'bat' },
    });
    const events = Array.from({ length: stored.head }, (_, i) => stored.events[String(i)]);
    expect(events.every((e) => e?.by === 'v1-migration' && e.at === MATCH_TIME)).toBe(true);

    const state = replay(
      toMatchSetup(stored.meta),
      events.map((e) => toDomainEvent(e as NonNullable<typeof e>)),
    );
    expect(state.result).toMatchObject({ kind: 'win', winner: ids.eagles });
    expect(state.innings[0]).toMatchObject({
      runs: 10,
      wickets: 2,
      legalBalls: 4,
      endReason: 'all_out',
    });
    expect(state.innings[0]?.extras).toEqual({ wides: 2, noBalls: 1, byes: 2, legByes: 0 });
    expect(state.innings[1]?.batters[ids.bo]?.dismissal).toEqual({
      kind: 'run_out',
      fielder: ids.ben,
    });
    expect(state.playerOfMatch).toBe(ids.bea);

    expect(database.matchSummaries[ids.match]).toMatchObject({
      status: 'complete',
      updatedAt: MATCH_TIME,
    });
    expect(database.matchResults[ids.match]).toMatchObject({ result: { winner: ids.eagles } });
    expect(database.teams[ids.huskies]).toEqual({
      name: 'Huskies',
      tournamentId: 'default',
      group: 'A',
      captainId: ids.asha,
      players: {
        [ids.asha]: { name: 'Asha', order: 0 },
        [ids.ben]: { name: 'Ben', order: 1 },
        [ids.dev]: { name: 'Dev', order: 2 },
      },
    });
    expect(database.tournaments.default).toMatchObject({ name: 'Test Cup', playoffFormat: 'none' });
  });

  it('adds players created after the match began when they first play', () => {
    const late = pushId(MATCH_TIME + 5 * 60_000, 'dev');
    const backup = edit((b) => {
      const team = b.teams[ids.huskies] as Backup['teams'][string];
      delete team.players[ids.dev];
      team.players[late] = { name: 'Dev' };
      const inn = match(b).innings1;
      inn.outPlayers = [ids.asha, late];
      inn.playerStats[late] = inn.playerStats[ids.dev] as (typeof inn.playerStats)[string];
      delete inn.playerStats[ids.dev];
    });
    const { database, report } = migrate(backup);
    expect(report.matches[0]?.outcome).toBe('exact');
    const stored = database.matches[ids.match];
    expect(stored?.meta.players[late]).toBeUndefined();
    // Added before Asha's wicket, otherwise two players would already be all out.
    const types = Object.values(stored?.events ?? {}).map((e) => e.type);
    expect(types.slice(types.indexOf('add_player'), types.indexOf('new_batter') + 1)).toEqual([
      'add_player',
      'delivery',
      'new_batter',
    ]);
    expect(Object.values(stored?.events ?? {})).toContainEqual(
      expect.objectContaining({ type: 'add_player', player: late, playerName: 'Dev' }),
    );
  });

  it('trusts the innings record over commentary for who was out', () => {
    // v1 printed the striker's name for "Bowled!" even when the non-striker was marked out.
    const backup = edit((b) => {
      const inn = match(b).innings1;
      inn.outPlayers = [ids.asha, ids.ben];
      Object.assign(inn.playerStats[ids.ben] as object, { dismissal: 'b Bea' });
      delete (inn.playerStats[ids.dev] as { dismissal?: string }).dismissal;
    });
    const { report } = migrate(backup);
    expect(report.matches[0]?.adjustments).toEqual([
      expect.stringContaining('non-striker Ben bowled; migrated as run out'),
    ]);
    expect(report.matches[0]?.notes).toEqual([
      expect.stringMatching(/bowler .* wickets: v1 2, replay 1/),
    ]);
  });

  it('matches players renamed since the match', () => {
    const backup = edit((b) => {
      (b.teams[ids.eagles] as Backup['teams'][string]).players[ids.cal] = { name: 'Cally' };
    });
    const { report } = migrate(backup);
    expect(report.matches[0]).toMatchObject({
      outcome: 'exact',
      adjustments: ['"Cal" in the commentary is Cally (renamed since)'],
    });
  });

  it('records a batter swapped out without a wicket as retired hurt', () => {
    // Cal walks in for Bo, who never bats again, without a wicket falling.
    const backup = edit((b) => {
      const inn = match(b).innings2;
      inn.commentaryLog = [
        { type: 'ball', over: '0.1', label: 6, text: 'Asha to Bea. 6 runs.' },
        { type: 'ball', over: '0.2', label: 1, text: 'Asha to Cal. 1 run.' },
        { type: 'ball', over: '0.3', label: 4, text: 'Asha to Bea. 4 runs.' },
      ];
    });
    const { database, report } = migrate(backup);
    expect(report.matches[0]?.adjustments).toContainEqual(
      expect.stringContaining('Cal replaced Bo without a wicket; recorded as retired hurt'),
    );
    expect(Object.values(database.matches[ids.match]?.events ?? {})).toContainEqual(
      expect.objectContaining({ type: 'retire', batter: ids.bo, kind: 'retired_hurt' }),
    );
  });

  it('reports wicket margins that differ from v1 as information, not a failure', () => {
    const backup = edit((b) => {
      match(b).result = 'Eagles won by 2 wickets';
    });
    expect(migrate(backup).report.matches[0]).toMatchObject({
      outcome: 'exact',
      adjustments: [
        'v1 showed "Eagles won by 2 wickets"; the new rules give "Eagles won by 1 wickets"',
      ],
    });
  });

  it('flags any other difference from v1', () => {
    const backup = edit((b) => {
      match(b).innings1.runs = 12;
    });
    expect(migrate(backup).report.matches[0]).toMatchObject({
      outcome: 'different',
      notes: ['Innings 1 runs: v1 12, replay 10'],
    });
  });

  it('skips matches it cannot convert and says why', () => {
    const backup = edit((b) => {
      delete (b.teams as Record<string, unknown>)[ids.eagles];
    });
    expect(migrate(backup).report.matches).toEqual([
      expect.objectContaining({
        outcome: 'skipped',
        notes: [`Team ${ids.eagles} no longer exists`],
      }),
    ]);

    const garbled = edit((b) => {
      match(b).innings1.commentaryLog[0] = {
        type: 'ball',
        over: '0.1',
        label: 'X',
        text: 'Bea to Asha. ???',
      };
    });
    expect(migrate(garbled).report.matches[0]?.notes).toEqual([
      'Innings 1, ball 1: Unrecognised ball label "X"',
    ]);
  });
});

describe('pushIdTime', () => {
  it('reads the creation time from a Firebase push id', () => {
    expect(pushIdTime(pushId(MATCH_TIME, 'abc'))).toBe(MATCH_TIME);
    expect(pushIdTime('default')).toBeNull();
  });
});
