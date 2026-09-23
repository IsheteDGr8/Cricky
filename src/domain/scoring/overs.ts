export const BALLS_PER_OVER = 6;

/** 20 legal balls -> "3.2" (3 overs and 2 balls, cricket notation, not a decimal). */
export function ballsToOvers(legalBalls: number): string {
  assertNonNegativeInteger(legalBalls, 'legalBalls');
  return `${Math.floor(legalBalls / BALLS_PER_OVER)}.${legalBalls % BALLS_PER_OVER}`;
}

/** "3.2" -> 20. Accepts "3" as "3.0". Throws on malformed input such as "3.6" or "-1". */
export function oversToBalls(overs: string): number {
  const match = /^(\d+)(?:\.(\d))?$/.exec(overs.trim());
  if (!match) throw new RangeError(`Invalid overs value: "${overs}"`);
  const whole = Number(match[1]);
  const balls = match[2] === undefined ? 0 : Number(match[2]);
  if (balls >= BALLS_PER_OVER) throw new RangeError(`Invalid overs value: "${overs}"`);
  return whole * BALLS_PER_OVER + balls;
}

/** Runs per over. Returns 0 before any legal ball is bowled. */
export function runRate(runs: number, legalBalls: number): number {
  assertNonNegativeInteger(runs, 'runs');
  assertNonNegativeInteger(legalBalls, 'legalBalls');
  if (legalBalls === 0) return 0;
  return (runs * BALLS_PER_OVER) / legalBalls;
}

/**
 * Runs per over needed to reach `target` from `runs` in `ballsRemaining`.
 * Returns 0 when the target is already reached, and Infinity when runs are
 * still needed but no balls remain.
 */
export function requiredRunRateFor(target: number, runs: number, ballsRemaining: number): number {
  assertNonNegativeInteger(target, 'target');
  assertNonNegativeInteger(runs, 'runs');
  assertNonNegativeInteger(ballsRemaining, 'ballsRemaining');
  const needed = target - runs;
  if (needed <= 0) return 0;
  if (ballsRemaining === 0) return Infinity;
  return (needed * BALLS_PER_OVER) / ballsRemaining;
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer, got ${value}`);
  }
}
