import { currentInnings } from './engine';
import { BALLS_PER_OVER, requiredRunRateFor } from './overs';
import { ballsRemaining, target } from './result';
import { wicketLimit } from './rules';
import type { BatterLine, BowlerLine, MatchState, PlayerId } from './types';

/** Players who can come in to bat next: in the squad, not at the crease, not already out. */
export function availableBatters(state: MatchState): PlayerId[] {
  const inn = currentInnings(state);
  const squad = state.squads[inn.battingTeam] ?? [];
  return squad.filter(
    (p) => p !== inn.striker && p !== inn.nonStriker && !inn.batters[p]?.dismissal,
  );
}

/** Players who may bowl the next ball (anyone except the previous over's bowler). */
export function availableBowlers(state: MatchState): PlayerId[] {
  const inn = currentInnings(state);
  const squad = state.squads[inn.bowlingTeam] ?? [];
  return squad.filter((p) => p !== inn.previousOverBowler);
}

export function currentWicketLimit(state: MatchState): number {
  const inn = currentInnings(state);
  return wicketLimit(state.squads[inn.battingTeam]?.length ?? 0);
}

/** Runs per over the chasing side needs; null during the first innings. */
export function requiredRunRate(state: MatchState): number | null {
  const t = target(state);
  if (t === null) return null;
  return requiredRunRateFor(t, currentInnings(state).runs, ballsRemaining(state));
}

export function strikeRate(line: Pick<BatterLine, 'runs' | 'balls'>): number {
  return line.balls === 0 ? 0 : (line.runs * 100) / line.balls;
}

export function economy(line: Pick<BowlerLine, 'runsConceded' | 'legalBalls'>): number {
  return line.legalBalls === 0 ? 0 : (line.runsConceded * BALLS_PER_OVER) / line.legalBalls;
}

export type NextAction =
  'set_openers' | 'set_bowler' | 'new_batter' | 'delivery' | 'set_player_of_match' | 'none';

/** What the scorer needs to do next. Drives the scoring screen's prompts. */
export function nextAction(state: MatchState): NextAction {
  if (state.status === 'complete') return state.playerOfMatch ? 'none' : 'set_player_of_match';
  const inn = currentInnings(state);
  if (inn.battingOrder.length === 0) return 'set_openers';
  if (inn.awaitingBatter) return 'new_batter';
  if (!inn.bowler) return 'set_bowler';
  return 'delivery';
}
