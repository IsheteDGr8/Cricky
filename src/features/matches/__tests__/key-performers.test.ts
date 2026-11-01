import type { CompletedMatch, PlayerBatting, PlayerBowling } from '@/domain';
import {
  battingText,
  bowlingText,
  performerLines,
  performerText,
  topBatters,
  topBowlers,
} from '../key-performers';

const bat = (
  player: string,
  team: string,
  runs: number,
  balls: number,
  out = true,
): PlayerBatting => ({ player, team, runs, balls, fours: 0, sixes: 0, out });
const bowl = (
  player: string,
  team: string,
  wickets: number,
  runsConceded: number,
  legalBalls = 12,
): PlayerBowling => ({ player, team, legalBalls, runsConceded, wickets, maidens: 0 });

const match: CompletedMatch = {
  id: 'm1',
  teamA: 'A',
  teamB: 'B',
  oversPerInnings: 5,
  result: { kind: 'win', winner: 'A', loser: 'B', margin: { by: 'runs', runs: 10 } },
  innings: [
    { battingTeam: 'A', bowlingTeam: 'B', runs: 60, wickets: 2, legalBalls: 30, allOut: false },
    { battingTeam: 'B', bowlingTeam: 'A', runs: 50, wickets: 5, legalBalls: 30, allOut: true },
  ],
  batting: [
    bat('a1', 'A', 30, 20),
    bat('a2', 'A', 25, 12, false),
    bat('a3', 'A', 25, 15),
    bat('b1', 'B', 40, 25),
    bat('b2', 'B', 0, 1),
  ],
  bowling: [
    bowl('b3', 'B', 1, 30),
    bowl('b4', 'B', 1, 20),
    bowl('a1', 'A', 3, 15),
    bowl('a4', 'A', 0, 0, 0),
  ],
  playerOfMatch: null,
};

describe('key performers', () => {
  it('ranks by runs plus 20 per wicket and merges bat and ball', () => {
    const lines = performerLines(match);
    expect(lines[0]).toMatchObject({ player: 'a1', impact: 30 + 60 });
    expect(lines[0]?.batting?.runs).toBe(30);
    expect(lines[0]?.bowling?.wickets).toBe(3);
    expect(lines[1]).toMatchObject({ player: 'b1', impact: 40 });
    expect(lines.some((l) => l.player === 'a4')).toBe(false);
  });

  it('picks top batters by runs, then fewer balls', () => {
    expect(topBatters(match, 'A').map((b) => b.player)).toEqual(['a1', 'a2', 'a3']);
    expect(topBatters(match, 'A', 1).map((b) => b.player)).toEqual(['a1']);
  });

  it('picks top bowlers by wickets, then fewer runs, skipping anyone who bowled no balls', () => {
    expect(topBowlers(match, 'B').map((b) => b.player)).toEqual(['b4', 'b3']);
    expect(topBowlers(match, 'A').map((b) => b.player)).toEqual(['a1']);
  });

  it('formats figures', () => {
    expect(battingText(bat('x', 'A', 45, 30, false))).toBe('45* (30)');
    expect(bowlingText(bowl('x', 'A', 2, 18, 20))).toBe('2/18 (3.2 ov)');
    expect(performerText(performerLines(match)[0]!)).toBe('30 (20) · 3/15 (2.0 ov)');
  });
});
