import type { BallRecord } from './types';

/** One vertex of a cricket worm: team score after this many legal balls. */
export interface WormPoint {
  legalBalls: number;
  runs: number;
}

/** Cumulative score after every delivery, starting at 0/0. */
export function wormSeries(deliveries: readonly BallRecord[]): WormPoint[] {
  const points: WormPoint[] = [{ legalBalls: 0, runs: 0 }];
  let legal = 0;
  for (const ball of deliveries) {
    if (ball.legal) legal += 1;
    const prev = points[points.length - 1];
    if (prev && prev.legalBalls === legal && prev.runs === ball.scoreAfter.runs) continue;
    points.push({ legalBalls: legal, runs: ball.scoreAfter.runs });
  }
  return points;
}

/** Shared axes so two innings can be drawn on the same chart. */
export function wormExtent(series: readonly (readonly WormPoint[])[]): {
  maxBalls: number;
  maxRuns: number;
} {
  let maxBalls = 1;
  let maxRuns = 1;
  for (const points of series) {
    for (const point of points) {
      if (point.legalBalls > maxBalls) maxBalls = point.legalBalls;
      if (point.runs > maxRuns) maxRuns = point.runs;
    }
  }
  return { maxBalls, maxRuns };
}
