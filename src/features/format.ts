import { ballsToOvers, type MatchResult, type TeamId } from '@/domain';
import type { MatchSummary } from '@/data';

type Name = (team: TeamId) => string;

/** "123/4" */
export function scoreText(runs: number, wickets: number): string {
  return `${runs}/${wickets}`;
}

/** "(12.3 ov)" */
export function oversText(legalBalls: number): string {
  return `(${ballsToOvers(legalBalls)} ov)`;
}

/** Run rates to two places; "–" when there is no rate (no balls bowled, or none left). */
export function rateText(rate: number | null): string {
  return rate === null || !Number.isFinite(rate) ? '–' : rate.toFixed(2);
}

/** Net run rate with its sign: "+1.234", "-0.500". */
export function nrrText(nrr: number): string {
  const fixed = nrr.toFixed(3);
  return nrr > 0 ? `+${fixed}` : fixed === '-0.000' ? '0.000' : fixed;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "Huskies won by 6 wickets (8 balls left)", "Eagles won by 12 runs", "Match tied". */
export function resultText(result: MatchResult, name: Name): string {
  if (result.kind === 'tie') return 'Match tied';
  const { margin } = result;
  if (margin.by === 'runs') return `${name(result.winner)} won by ${plural(margin.runs, 'run')}`;
  const left = margin.ballsRemaining > 0 ? ` (${plural(margin.ballsRemaining, 'ball')} left)` : '';
  return `${name(result.winner)} won by ${plural(margin.wickets, 'wicket')}${left}`;
}

/** The same, from the smaller record match lists read. */
export function summaryResultText(summary: MatchSummary): string | null {
  const { result } = summary;
  if (!result) return null;
  if (result.kind === 'tie') return 'Match tied';
  const winner = result.winner === summary.teamA ? summary.teamAName : summary.teamBName;
  return `${winner} won by ${plural(result.margin, result.by === 'runs' ? 'run' : 'wicket')}`;
}

export function dateText(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
