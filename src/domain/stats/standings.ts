import { BALLS_PER_OVER, type TeamId } from '../scoring';
import { nrrBalls, type CompletedMatch } from './summary';

export interface PointsRules {
  win: number;
  tie: number;
  loss: number;
}

export const DEFAULT_POINTS: PointsRules = { win: 2, tie: 1, loss: 0 };

export interface StandingRow {
  team: TeamId;
  played: number;
  won: number;
  lost: number;
  tied: number;
  points: number;
  runsFor: number;
  ballsFaced: number;
  runsAgainst: number;
  ballsBowled: number;
  netRunRate: number;
}

/**
 * Points table for `teams`, counting only matches played between two of them.
 * Pass one group's teams to get that group's table. Callers decide which matches
 * count (e.g. group stage only, not playoffs).
 * Order: points, net run rate, wins, then team id for a stable result.
 */
export function computeStandings(
  teams: readonly TeamId[],
  matches: readonly CompletedMatch[],
  rules: PointsRules = DEFAULT_POINTS,
): StandingRow[] {
  const rows = new Map<TeamId, StandingRow>(teams.map((team) => [team, emptyRow(team)]));

  for (const match of matches) {
    const a = rows.get(match.teamA);
    const b = rows.get(match.teamB);
    if (!a || !b) continue;

    for (const row of [a, b]) row.played += 1;
    if (match.result.kind === 'tie') {
      a.tied += 1;
      b.tied += 1;
      a.points += rules.tie;
      b.points += rules.tie;
    } else {
      const winner = rows.get(match.result.winner);
      const loser = rows.get(match.result.loser);
      if (winner) {
        winner.won += 1;
        winner.points += rules.win;
      }
      if (loser) {
        loser.lost += 1;
        loser.points += rules.loss;
      }
    }

    for (const inn of match.innings) {
      const balls = nrrBalls(inn, match.oversPerInnings);
      const batting = rows.get(inn.battingTeam);
      const bowling = rows.get(inn.bowlingTeam);
      if (batting) {
        batting.runsFor += inn.runs;
        batting.ballsFaced += balls;
      }
      if (bowling) {
        bowling.runsAgainst += inn.runs;
        bowling.ballsBowled += balls;
      }
    }
  }

  const result = [...rows.values()];
  for (const row of result) row.netRunRate = netRunRate(row);
  return result.sort(
    (x, y) =>
      y.points - x.points ||
      y.netRunRate - x.netRunRate ||
      y.won - x.won ||
      x.team.localeCompare(y.team),
  );
}

export function netRunRate(
  row: Pick<StandingRow, 'runsFor' | 'ballsFaced' | 'runsAgainst' | 'ballsBowled'>,
): number {
  const forRate = row.ballsFaced > 0 ? (row.runsFor * BALLS_PER_OVER) / row.ballsFaced : 0;
  const againstRate =
    row.ballsBowled > 0 ? (row.runsAgainst * BALLS_PER_OVER) / row.ballsBowled : 0;
  return forRate - againstRate;
}

function emptyRow(team: TeamId): StandingRow {
  return {
    team,
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    points: 0,
    runsFor: 0,
    ballsFaced: 0,
    runsAgainst: 0,
    ballsBowled: 0,
    netRunRate: 0,
  };
}
