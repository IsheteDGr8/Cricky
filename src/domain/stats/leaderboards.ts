import { BALLS_PER_OVER, type PlayerId, type TeamId } from '../scoring';
import type { CompletedMatch } from './summary';

export interface BattingLeader {
  player: PlayerId;
  team: TeamId;
  innings: number;
  runs: number;
  balls: number;
  notOuts: number;
  fours: number;
  sixes: number;
  highest: number;
  highestNotOut: boolean;
  /** null when the batter has never been dismissed. */
  average: number | null;
  strikeRate: number;
}

export interface BowlingLeader {
  player: PlayerId;
  team: TeamId;
  innings: number;
  legalBalls: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
  best: { wickets: number; runs: number };
  economy: number;
  /** null when the bowler has no wickets. */
  average: number | null;
}

/** Most runs first; ties broken by strike rate, then player id. */
export function battingLeaders(
  matches: readonly CompletedMatch[],
  limit?: number,
): BattingLeader[] {
  const byPlayer = new Map<PlayerId, BattingLeader>();

  for (const line of matches.flatMap((m) => m.batting)) {
    const row = byPlayer.get(line.player) ?? {
      player: line.player,
      team: line.team,
      innings: 0,
      runs: 0,
      balls: 0,
      notOuts: 0,
      fours: 0,
      sixes: 0,
      highest: 0,
      highestNotOut: false,
      average: null,
      strikeRate: 0,
    };
    row.innings += 1;
    row.runs += line.runs;
    row.balls += line.balls;
    row.fours += line.fours;
    row.sixes += line.sixes;
    if (!line.out) row.notOuts += 1;
    if (line.runs > row.highest || (line.runs === row.highest && !line.out)) {
      row.highest = line.runs;
      row.highestNotOut = !line.out;
    }
    byPlayer.set(line.player, row);
  }

  const rows = [...byPlayer.values()].map((row) => {
    const dismissals = row.innings - row.notOuts;
    return {
      ...row,
      average: dismissals > 0 ? row.runs / dismissals : null,
      strikeRate: row.balls > 0 ? (row.runs * 100) / row.balls : 0,
    };
  });
  rows.sort(
    (a, b) => b.runs - a.runs || b.strikeRate - a.strikeRate || a.player.localeCompare(b.player),
  );
  return limit === undefined ? rows : rows.slice(0, limit);
}

/** Most wickets first; ties broken by economy (lower is better), then player id. */
export function bowlingLeaders(
  matches: readonly CompletedMatch[],
  limit?: number,
): BowlingLeader[] {
  const byPlayer = new Map<PlayerId, BowlingLeader>();

  for (const line of matches.flatMap((m) => m.bowling)) {
    const row = byPlayer.get(line.player) ?? {
      player: line.player,
      team: line.team,
      innings: 0,
      legalBalls: 0,
      runsConceded: 0,
      wickets: 0,
      maidens: 0,
      best: { wickets: 0, runs: 0 },
      economy: 0,
      average: null,
    };
    row.innings += 1;
    row.legalBalls += line.legalBalls;
    row.runsConceded += line.runsConceded;
    row.wickets += line.wickets;
    row.maidens += line.maidens;
    const isBetter =
      row.innings === 1 ||
      line.wickets > row.best.wickets ||
      (line.wickets === row.best.wickets && line.runsConceded < row.best.runs);
    if (isBetter) row.best = { wickets: line.wickets, runs: line.runsConceded };
    byPlayer.set(line.player, row);
  }

  const rows = [...byPlayer.values()].map((row) => ({
    ...row,
    economy: row.legalBalls > 0 ? (row.runsConceded * BALLS_PER_OVER) / row.legalBalls : 0,
    average: row.wickets > 0 ? row.runsConceded / row.wickets : null,
  }));
  rows.sort(
    (a, b) => b.wickets - a.wickets || a.economy - b.economy || a.player.localeCompare(b.player),
  );
  return limit === undefined ? rows : rows.slice(0, limit);
}
