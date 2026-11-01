import type { MatchResultRecord, MatchRoster, WithId } from '@/data';
import { buildStats } from '../build-stats';

function record(
  id: string,
  extra: Partial<MatchResultRecord> & Pick<MatchResultRecord, 'batting' | 'bowling'>,
): WithId<MatchResultRecord> {
  return {
    id,
    stage: 'quick',
    teamA: `${id}-A`,
    teamB: `${id}-B`,
    oversPerInnings: 5,
    result: {
      kind: 'win',
      winner: `${id}-A`,
      loser: `${id}-B`,
      margin: { by: 'runs', runs: 5 },
    },
    innings: [
      {
        battingTeam: `${id}-A`,
        bowlingTeam: `${id}-B`,
        runs: 50,
        wickets: 2,
        legalBalls: 30,
        allOut: false,
      },
      {
        battingTeam: `${id}-B`,
        bowlingTeam: `${id}-A`,
        runs: 45,
        wickets: 4,
        legalBalls: 30,
        allOut: false,
      },
    ],
    ...extra,
  };
}

const bat = (player: string, team: string, runs: number, balls: number, sixes = 0, out = true) => ({
  player,
  team,
  runs,
  balls,
  fours: 0,
  sixes,
  out,
});
const bowl = (player: string, team: string, wickets: number, runsConceded: number) => ({
  player,
  team,
  legalBalls: 12,
  runsConceded,
  wickets,
  maidens: 0,
});

// Two quick matches where "Asha" plays both with different ids, plus one tournament match.
const results = [
  record('q1', {
    batting: [bat('p1', 'q1-A', 30, 20, 2), bat('p2', 'q1-B', 10, 12)],
    bowling: [bowl('p3', 'q1-B', 2, 15)],
    playerOfMatch: 'p1',
  }),
  record('q2', {
    batting: [bat('x9', 'q2-A', 41, 25, 3, false)],
    bowling: [bowl('x8', 'q2-B', 3, 10)],
    playerOfMatch: 'x9',
  }),
  record('t1', {
    stage: 'group',
    tournamentId: 'T',
    batting: [bat('t-asha', 't1-A', 12, 10)],
    bowling: [bowl('t-bo', 't1-B', 1, 20)],
  }),
];

const rosters: Record<string, MatchRoster> = {
  q1: {
    teams: { 'q1-A': 'Owls', 'q1-B': 'Larks' },
    players: {
      p1: { name: 'Asha', team: 'q1-A' },
      p2: { name: 'Ben', team: 'q1-B' },
      p3: { name: 'Cy', team: 'q1-B' },
    },
  },
  q2: {
    teams: { 'q2-A': 'Owls', 'q2-B': 'Hawks' },
    players: { x9: { name: ' asha ', team: 'q2-A' }, x8: { name: 'Cy', team: 'q2-B' } },
  },
  t1: {
    teams: { 't1-A': 'Huskies', 't1-B': 'Eagles' },
    players: { 't-asha': { name: 'Asha', team: 't1-A' }, 't-bo': { name: 'Bo', team: 't1-B' } },
  },
};

describe('buildStats', () => {
  it('merges the same name across quick matches', () => {
    const stats = buildStats(results, rosters, { kind: 'quick' });
    expect(stats.matches).toBe(2);
    const top = stats.batting[0]!;
    expect(stats.playerName(top.player)).toBe('Asha');
    expect(top).toMatchObject({ runs: 71, innings: 2, sixes: 5 });
    expect(stats.appearances.get(top.player)).toBe(2);
    expect(stats.bowling[0]).toMatchObject({ wickets: 5 });
    expect(stats.playerOfMatch[0]).toMatchObject({ player: top.player, count: 2 });
  });

  it('counts everything overall, including tournament matches', () => {
    const stats = buildStats(results, rosters, { kind: 'all' });
    expect(stats.matches).toBe(3);
    expect(stats.batting[0]).toMatchObject({ runs: 83, innings: 3 });
    expect(stats.totals).toEqual({ runs: 285, wickets: 18, fours: 0, sixes: 5 });
  });

  it('keeps a tournament to its own matches and ids', () => {
    const stats = buildStats(results, rosters, { kind: 'tournament', id: 'T' });
    expect(stats.matches).toBe(1);
    expect(stats.batting.map((b) => b.player)).toEqual(['t-asha']);
    expect(stats.teamName('t1-A')).toBe('Huskies');
  });

  it('finds the records', () => {
    const stats = buildStats(results, rosters, { kind: 'all' });
    expect(stats.highestScore).toMatchObject({ runs: 41, balls: 25, notOut: true });
    expect(stats.playerName(stats.highestScore!.player)).toBe('Asha');
    expect(stats.bestBowling).toMatchObject({ wickets: 3, runs: 10 });
    expect(stats.highestTotal).toMatchObject({ runs: 50 });
  });

  it('is empty when nothing is in scope', () => {
    const stats = buildStats(results, rosters, { kind: 'tournament', id: 'nope' });
    expect(stats.matches).toBe(0);
    expect(stats.batting).toEqual([]);
    expect(stats.highestScore).toBeNull();
  });
});
