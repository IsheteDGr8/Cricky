import { ballsToOvers, wormSeries } from '@/domain';
import type { MatchView } from './match-view';

/** Spoken summary of the worm: one sentence per innings. */
export function wormCaption(view: MatchView): string {
  if (view.innings.length === 0) return 'Worm chart is empty until the first ball.';
  return view.innings
    .map((inn) => {
      const overs = ballsToOvers(inn.legalBalls);
      return `${view.teamName(inn.battingTeam)} ${inn.runs} from ${overs} overs`;
    })
    .join('. ');
}

export function wormLines(view: MatchView) {
  return view.innings.map((inn) => ({
    key: `${inn.number}-${inn.battingTeam}`,
    label: view.teamName(inn.battingTeam),
    innings: inn.number,
    runs: inn.runs,
    legalBalls: inn.legalBalls,
    points: wormSeries(inn.deliveries),
  }));
}
