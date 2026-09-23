import { BALLS_PER_OVER } from './overs';
import { wicketLimit } from './rules';
import type { MatchResult, MatchState } from './types';

/** Runs the side batting second needs, or null while the first innings is still in progress. */
export function target(state: MatchState): number | null {
  const [first, second] = state.innings;
  if (!first || !second) return null;
  return first.runs + 1;
}

/** Legal balls left in the current innings. */
export function ballsRemaining(state: MatchState): number {
  const inn = state.innings[state.innings.length - 1];
  if (!inn) return 0;
  return Math.max(0, state.oversPerInnings * BALLS_PER_OVER - inn.legalBalls);
}

export function computeResult(state: MatchState): MatchResult {
  const [first, second] = state.innings;
  if (!first || !second) throw new Error('A result needs two innings');

  if (second.runs > first.runs) {
    const limit = wicketLimit(state.squads[second.battingTeam]?.length ?? 0);
    return {
      kind: 'win',
      winner: second.battingTeam,
      loser: first.battingTeam,
      margin: {
        by: 'wickets',
        wickets: limit - second.wickets,
        ballsRemaining: Math.max(0, state.oversPerInnings * BALLS_PER_OVER - second.legalBalls),
      },
    };
  }
  if (first.runs > second.runs) {
    return {
      kind: 'win',
      winner: first.battingTeam,
      loser: second.battingTeam,
      margin: { by: 'runs', runs: first.runs - second.runs },
    };
  }
  return { kind: 'tie' };
}
