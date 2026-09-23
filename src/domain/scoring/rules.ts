import type { DeliveryDismissalKind, DismissalKind, ExtraType } from './types';

/** Upper bound for runs recorded on a single delivery (e.g. 4 overthrows after running 3). */
export const MAX_RUNS_PER_DELIVERY = 7;

export const MAX_OVERS_PER_INNINGS = 50;

/** An innings ends when this many wickets fall: the last batter has no partner. */
export function wicketLimit(squadSize: number): number {
  return Math.max(1, squadSize - 1);
}

/** Wides and no-balls must be re-bowled; everything else counts toward the over. */
export function isLegalDelivery(extra: ExtraType | undefined): boolean {
  return extra !== 'wide' && extra !== 'no_ball';
}

/** Penalty runs added on top of `runs` for this kind of delivery. */
export function penaltyRuns(extra: ExtraType | undefined): number {
  return extra === 'wide' || extra === 'no_ball' ? 1 : 0;
}

/** The striker is credited with facing every delivery except a wide. */
export function countsAsBallFaced(extra: ExtraType | undefined): boolean {
  return extra !== 'wide';
}

/** Whether the delivery's runs are credited to the striker. */
export function runsCreditedToBatter(extra: ExtraType | undefined): boolean {
  return extra === undefined || extra === 'no_ball';
}

/** Byes and leg-byes are not charged to the bowler; everything else is. */
export function runsChargedToBowler(extra: ExtraType | undefined, runs: number): number {
  if (extra === 'bye' || extra === 'leg_bye') return 0;
  return runs + penaltyRuns(extra);
}

/** Dismissals the bowler gets credit for. */
export function isBowlerWicket(kind: DismissalKind): boolean {
  return kind !== 'run_out' && kind !== 'retired_out';
}

/** Dismissals where only the striker can be out. */
export function strikerOnly(kind: DeliveryDismissalKind): boolean {
  return kind !== 'run_out';
}

/** Dismissals where no runs can be completed on the delivery. */
export function forbidsRuns(kind: DeliveryDismissalKind): boolean {
  return kind !== 'run_out';
}

/**
 * Which dismissals are possible on each kind of delivery (Laws of Cricket):
 * - wide: stumped, run out or hit wicket
 * - no-ball: only run out
 * - bye / leg-bye: only run out (any other dismissal would end the ball first)
 */
export function isDismissalAllowed(
  kind: DeliveryDismissalKind,
  extra: ExtraType | undefined,
): boolean {
  switch (extra) {
    case undefined:
      return true;
    case 'wide':
      return kind === 'stumped' || kind === 'run_out' || kind === 'hit_wicket';
    case 'no_ball':
    case 'bye':
    case 'leg_bye':
      return kind === 'run_out';
  }
}
