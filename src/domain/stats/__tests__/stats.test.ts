import { dots, ev, firstInningsOf, makeSetup, over, play } from '../../__fixtures__/scoring';
import type { TeamId } from '../../scoring';
import { battingLeaders, bowlingLeaders } from '../leaderboards';
import { computeStandings, netRunRate } from '../standings';
import {
  nrrBalls,
  scoreSummary,
  summarizeMatch,
  type CompletedMatch,
  type InningsSummary,
  type PlayerBatting,
  type PlayerBowling,
} from '../summary';

function innings(
  battingTeam: TeamId,
  bowlingTeam: TeamId,
  runs: number,
  legalBalls: number,
  allOut = false,
): InningsSummary {
  return { battingTeam, bowlingTeam, runs, wickets: allOut ? 4 : 1, legalBalls, allOut };
}

/** A 5-over match where `first` batted first. Result is derived from the scores. */
function match(
  id: string,
  first: InningsSummary,
  second: InningsSummary,
  extra: { batting?: PlayerBatting[]; bowling?: PlayerBowling[] } = {},
): CompletedMatch {
  const result: CompletedMatch['result'] =
    first.runs === second.runs
      ? { kind: 'tie' }
      : first.runs > second.runs
        ? {
            kind: 'win',
            winner: first.battingTeam,
            loser: second.battingTeam,
            margin: { by: 'runs', runs: first.runs - second.runs },
          }
        : {
            kind: 'win',
            winner: second.battingTeam,
            loser: first.battingTeam,
            margin: { by: 'wickets', wickets: 1, ballsRemaining: 0 },
          };
  return {
    id,
    teamA: first.battingTeam,
    teamB: first.bowlingTeam,
    oversPerInnings: 5,
    result,
    innings: [first, second],
    batting: extra.batting ?? [],
    bowling: extra.bowling ?? [],
    playerOfMatch: null,
  };
}

describe('summarizeMatch', () => {
  const events = [
    ...firstInningsOf([4, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]), // A: 5/0
    ev.openers('b1', 'b2'),
    ...over('a1', [ev.out('bowled', 'b1'), ev.batter('b3'), ...dots(5)]),
    ...over('a2', dots(6)),
    ev.potm('a1'),
  ];

  it('extracts innings, batting and bowling lines from a finished match', () => {
    const summary = summarizeMatch('m1', play(events));
    expect(summary).toMatchObject({
      id: 'm1',
      teamA: 'A',
      teamB: 'B',
      oversPerInnings: 2,
      playerOfMatch: 'a1',
      result: { kind: 'win', winner: 'A' },
    });
    expect(summary.innings[0]).toEqual({
      battingTeam: 'A',
      bowlingTeam: 'B',
      runs: 5,
      wickets: 0,
      legalBalls: 12,
      allOut: false,
    });
    expect(summary.batting).toContainEqual({
      player: 'a1',
      team: 'A',
      runs: 4,
      balls: 11,
      fours: 1,
      sixes: 0,
      out: false,
    });
    expect(summary.batting).toContainEqual(expect.objectContaining({ player: 'b1', out: true }));
    expect(summary.bowling).toContainEqual({
      player: 'a1',
      team: 'A',
      legalBalls: 6,
      runsConceded: 0,
      wickets: 1,
      maidens: 1,
    });
  });

  it('refuses a match that is still in progress', () => {
    expect(() => summarizeMatch('m2', play([ev.openers('a1', 'a2')]))).toThrow(
      'Match m2 is not complete',
    );
  });

  it('marks all-out innings', () => {
    const state = play(
      [ev.openers('a1', 'a2'), ev.bowler('b1'), ev.out('bowled', 'a1'), ev.endInnings()],
      makeSetup({ squadSize: 2 }),
    );
    expect(summarizeMatch('m3', state).innings[0].allOut).toBe(true);
  });
});

describe('scoreSummary', () => {
  it('is scheduled before the openers walk out', () => {
    expect(scoreSummary(play([]))).toEqual({
      status: 'scheduled',
      innings: [{ battingTeam: 'A', runs: 0, wickets: 0, legalBalls: 0 }],
    });
  });

  it('is live with the current score once play starts', () => {
    const state = play([
      ev.openers('a1', 'a2'),
      ev.bowler('b1'),
      ev.runs(4),
      ev.out('bowled', 'a1'),
    ]);
    expect(scoreSummary(state)).toEqual({
      status: 'live',
      innings: [{ battingTeam: 'A', runs: 4, wickets: 1, legalBalls: 2 }],
    });
  });

  it('shows the chase only after it starts', () => {
    const first = firstInningsOf([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(scoreSummary(play(first)).innings).toHaveLength(1);
    expect(scoreSummary(play([...first, ev.openers('b1', 'b2')])).innings).toHaveLength(2);
  });

  it('includes the result', () => {
    const first = firstInningsOf([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const byWickets = play([...first, ev.openers('b1', 'b2'), ...over('a1', [ev.runs(2)])]);
    expect(scoreSummary(byWickets)).toMatchObject({
      status: 'complete',
      result: { kind: 'win', winner: 'B', by: 'wickets', margin: 4 },
    });
    const byRuns = play([...first, ev.endInnings()]);
    expect(scoreSummary(byRuns)).toMatchObject({
      result: { kind: 'win', winner: 'A', by: 'runs', margin: 1 },
    });
    expect(scoreSummary(byRuns).innings).toHaveLength(2);
    const tie = play([
      ...first,
      ev.openers('b1', 'b2'),
      ...over('a1', [ev.runs(1)]),
      ev.endInnings(),
    ]);
    expect(scoreSummary(tie).result).toEqual({ kind: 'tie' });
  });
});

describe('nrrBalls', () => {
  it('counts an all-out innings as the full quota of overs', () => {
    expect(nrrBalls(innings('A', 'B', 20, 14, true), 5)).toBe(30);
    expect(nrrBalls(innings('A', 'B', 20, 14), 5)).toBe(14);
  });
});

describe('computeStandings', () => {
  const matches = [
    // A 50 (30 balls) beat B 40 (30 balls)
    match('1', innings('A', 'B', 50, 30), innings('B', 'A', 40, 30)),
    // C 30 all out in 12 balls; B chase 31 in 18 balls
    match('2', innings('C', 'B', 30, 12, true), innings('B', 'C', 31, 18)),
    // A and C tie on 45
    match('3', innings('A', 'C', 45, 30), innings('C', 'A', 45, 30)),
  ];

  it('awards points for wins and ties', () => {
    const table = computeStandings(['A', 'B', 'C'], matches);
    expect(table.map((r) => [r.team, r.played, r.won, r.lost, r.tied, r.points])).toEqual([
      ['A', 2, 1, 0, 1, 3],
      ['B', 2, 1, 1, 0, 2],
      ['C', 2, 0, 1, 1, 1],
    ]);
  });

  it('computes net run rate, with all-out innings using the full overs', () => {
    const table = computeStandings(['A', 'B', 'C'], matches);
    const c = table.find((r) => r.team === 'C');
    // C: scored 30 in 30 balls (all out) + 45 in 30 = 75 in 10 overs = 7.5
    //    conceded 31 in 18 balls + 45 in 30 = 76 in 8 overs = 9.5
    expect(c).toMatchObject({ runsFor: 75, ballsFaced: 60, runsAgainst: 76, ballsBowled: 48 });
    expect(c?.netRunRate).toBeCloseTo(-2);
  });

  it('only counts matches between the listed teams', () => {
    const table = computeStandings(['A', 'B'], matches);
    expect(table.map((r) => [r.team, r.played])).toEqual([
      ['A', 1],
      ['B', 1],
    ]);
  });

  it('supports custom points', () => {
    const table = computeStandings(['A', 'C'], [matches[2] as CompletedMatch], {
      win: 4,
      tie: 2,
      loss: 1,
    });
    expect(table.map((r) => r.points)).toEqual([2, 2]);
    const loss = computeStandings(['A', 'B'], [matches[0] as CompletedMatch], {
      win: 4,
      tie: 2,
      loss: 1,
    });
    expect(loss.map((r) => [r.team, r.points])).toEqual([
      ['A', 4],
      ['B', 1],
    ]);
  });

  it('breaks ties on net run rate, then wins, then name', () => {
    const empty = computeStandings(['Z', 'Y'], []);
    expect(empty.map((r) => r.team)).toEqual(['Y', 'Z']);
    expect(empty[0]).toMatchObject({ played: 0, points: 0, netRunRate: 0 });

    // X and W each win once; X wins by more, so has the better NRR.
    const table = computeStandings(
      ['W', 'X'],
      [
        match('a', innings('X', 'W', 60, 30), innings('W', 'X', 20, 30)),
        match('b', innings('W', 'X', 50, 30), innings('X', 'W', 40, 30)),
      ],
    );
    expect(table.map((r) => r.team)).toEqual(['X', 'W']);
  });

  it('netRunRate is zero with no balls', () => {
    expect(netRunRate({ runsFor: 0, ballsFaced: 0, runsAgainst: 0, ballsBowled: 0 })).toBe(0);
  });
});

describe('leaderboards', () => {
  const bat = (player: string, runs: number, balls: number, out: boolean): PlayerBatting => ({
    player,
    team: 'A',
    runs,
    balls,
    fours: 1,
    sixes: 0,
    out,
  });
  const bowl = (player: string, wickets: number, runsConceded: number): PlayerBowling => ({
    player,
    team: 'B',
    legalBalls: 12,
    runsConceded,
    wickets,
    maidens: 0,
  });

  const first = innings('A', 'B', 0, 0);
  const second = innings('B', 'A', 0, 0);
  const matches = [
    match('1', first, second, {
      batting: [bat('p1', 30, 20, true), bat('p2', 10, 5, false)],
      bowling: [bowl('q1', 2, 20), bowl('q2', 0, 10)],
    }),
    match('2', first, second, {
      batting: [bat('p1', 30, 25, false), bat('p2', 50, 30, true)],
      bowling: [bowl('q1', 2, 14), bowl('q2', 1, 30), bowl('q3', 3, 25)],
    }),
  ];

  it('ranks batters by runs and computes averages and strike rates', () => {
    const [top, next] = battingLeaders(matches);
    expect(top).toMatchObject({
      player: 'p2',
      innings: 2,
      runs: 60,
      balls: 35,
      notOuts: 1,
      fours: 2,
      highest: 50,
      highestNotOut: false,
      average: 60,
    });
    expect(top?.strikeRate).toBeCloseTo(171.43, 2);
    expect(next).toMatchObject({ player: 'p1', runs: 60, highest: 30, highestNotOut: true });
  });

  it('gives a null average to a batter who was never out', () => {
    const [row] = battingLeaders([
      match('x', first, second, { batting: [bat('p9', 0, 0, false)] }),
    ]);
    expect(row).toMatchObject({ average: null, strikeRate: 0 });
  });

  it('ranks bowlers by wickets then economy, and tracks best figures', () => {
    const rows = bowlingLeaders(matches);
    expect(rows.map((r) => r.player)).toEqual(['q1', 'q3', 'q2']);
    expect(rows[0]).toMatchObject({
      innings: 2,
      wickets: 4,
      legalBalls: 24,
      runsConceded: 34,
      best: { wickets: 2, runs: 14 },
      economy: 8.5,
      average: 8.5,
    });
    expect(rows[2]).toMatchObject({ best: { wickets: 1, runs: 30 } });
  });

  it('gives a null average to a bowler without wickets', () => {
    const [row] = bowlingLeaders([
      match('x', first, second, { bowling: [{ ...bowl('q9', 0, 0), legalBalls: 0 }] }),
    ]);
    expect(row).toMatchObject({ average: null, economy: 0 });
  });

  it('respects the limit', () => {
    expect(battingLeaders(matches, 1)).toHaveLength(1);
    expect(bowlingLeaders(matches, 2)).toHaveLength(2);
  });
});
