import type { BallRecord, Dismissal, InningsState, PlayerId } from './types';

export type NameLookup = (player: PlayerId) => string;

/** Cricket notation for when the ball was bowled, e.g. "3.4". Extras show the ball count before them. */
export function overLabel(ball: BallRecord): string {
  return `${ball.over}.${ball.ballInOver}`;
}

/** Compact label for over-by-over chips: "0", "4", "W", "2wd", "nb+4", "1lb". */
export function ballBadge(ball: BallRecord): string {
  if (ball.wicket) return ball.runs > 0 ? `W+${ball.runs}` : 'W';
  switch (ball.extra) {
    case 'wide':
      return ball.totalRuns > 1 ? `${ball.totalRuns}wd` : 'wd';
    case 'no_ball':
      return ball.runs > 0 ? `nb+${ball.runs}` : 'nb';
    case 'bye':
      return `${ball.runs}b`;
    case 'leg_bye':
      return `${ball.runs}lb`;
    case null:
      return String(ball.runs);
  }
}

export function describeDismissal(dismissal: Dismissal, name: NameLookup): string {
  const bowler = dismissal.bowler ? name(dismissal.bowler) : '';
  const fielder = dismissal.fielder ? name(dismissal.fielder) : '';
  switch (dismissal.kind) {
    case 'bowled':
      return `b ${bowler}`;
    case 'lbw':
      return `lbw b ${bowler}`;
    case 'caught':
      if (dismissal.fielder && dismissal.fielder === dismissal.bowler) return `c & b ${bowler}`;
      return fielder ? `c ${fielder} b ${bowler}` : `c ? b ${bowler}`;
    case 'stumped':
      return fielder ? `st ${fielder} b ${bowler}` : `st b ${bowler}`;
    case 'hit_wicket':
      return `hit wicket b ${bowler}`;
    case 'run_out':
      return fielder ? `run out (${fielder})` : 'run out';
    case 'retired_out':
      return 'retired out';
  }
}

function runsPhrase(runs: number): string {
  if (runs === 0) return 'no run';
  if (runs === 4) return 'FOUR';
  if (runs === 6) return 'SIX';
  return runs === 1 ? '1 run' : `${runs} runs`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** One line of ball-by-ball commentary, e.g. "Khan to Smith, FOUR". */
export function describeBall(ball: BallRecord, name: NameLookup): string {
  const prefix = `${name(ball.bowler)} to ${name(ball.striker)}, `;

  let outcome: string;
  switch (ball.extra) {
    case 'wide':
      outcome = ball.runs > 0 ? `wide, ${plural(ball.runs, 'extra run')}` : 'wide';
      break;
    case 'no_ball':
      outcome = ball.runs > 0 ? `no ball, ${runsPhrase(ball.runs)} off the bat` : 'no ball';
      break;
    case 'bye':
      outcome = plural(ball.runs, 'bye');
      break;
    case 'leg_bye':
      outcome = plural(ball.runs, 'leg bye');
      break;
    case null:
      outcome = runsPhrase(ball.runs);
      break;
  }

  if (!ball.wicket) return prefix + outcome;

  const out = name(ball.wicket.playerOut);
  const how = describeDismissal(
    {
      kind: ball.wicket.kind,
      ...(ball.wicket.kind !== 'run_out' ? { bowler: ball.bowler } : {}),
      ...(ball.wicket.fielder ? { fielder: ball.wicket.fielder } : {}),
    },
    name,
  );
  const completed =
    ball.wicket.kind === 'run_out' && ball.runs > 0 ? ` after ${plural(ball.runs, 'run')}` : '';
  const extraNote = ball.extra ? ` (${outcome})` : '';
  return `${prefix}OUT! ${out} ${how}${completed}${extraNote}`;
}

export interface OverSummary {
  /** 1-based over number for display ("Over 4"). */
  number: number;
  bowler: PlayerId;
  runs: number;
  wickets: number;
  complete: boolean;
  balls: BallRecord[];
  scoreAfter: { runs: number; wickets: number };
}

/** Groups deliveries into overs, most recent last. The final entry may be an over in progress. */
export function overSummaries(innings: InningsState): OverSummary[] {
  const byOver = new Map<number, BallRecord[]>();
  for (const ball of innings.deliveries) {
    const list = byOver.get(ball.over) ?? [];
    list.push(ball);
    byOver.set(ball.over, list);
  }

  return [...byOver.entries()]
    .sort(([a], [b]) => a - b)
    .map(([over, balls]) => {
      const last = balls[balls.length - 1] as BallRecord;
      return {
        number: over + 1,
        bowler: last.bowler,
        runs: balls.reduce((sum, b) => sum + b.totalRuns, 0),
        wickets: balls.filter((b) => b.wicket).length,
        complete: balls.filter((b) => b.legal).length === 6,
        balls,
        scoreAfter: last.scoreAfter,
      };
    });
}
