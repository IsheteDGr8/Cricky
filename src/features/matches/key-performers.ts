import {
  ballsToOvers,
  summarizeMatch,
  type CompletedMatch,
  type MatchState,
  type PlayerBatting,
  type PlayerBowling,
  type PlayerId,
  type TeamId,
} from '@/domain';

/** One player's whole match: what they did with the bat and the ball. */
export interface PerformerLine {
  player: PlayerId;
  team: TeamId;
  batting?: PlayerBatting;
  bowling?: PlayerBowling;
  /** Runs plus 20 per wicket: a rough guide to who changed the game. */
  impact: number;
}

export const WICKET_IMPACT = 20;

/** The finished match's figures, or null while it is still being played. */
export function completedSummary(id: string, state: MatchState): CompletedMatch | null {
  if (state.status !== 'complete' || !state.result || state.innings.length < 2) return null;
  try {
    return summarizeMatch(id, state);
  } catch {
    return null;
  }
}

/** Every player who batted or bowled, highest impact first. */
export function performerLines(match: CompletedMatch): PerformerLine[] {
  const lines = new Map<PlayerId, PerformerLine>();
  const lineFor = (player: PlayerId, team: TeamId) => {
    const existing = lines.get(player);
    if (existing) return existing;
    const created: PerformerLine = { player, team, impact: 0 };
    lines.set(player, created);
    return created;
  };
  for (const b of match.batting) {
    const line = lineFor(b.player, b.team);
    line.batting = b;
    line.impact += b.runs;
  }
  for (const b of match.bowling) {
    if (b.legalBalls === 0 && b.wickets === 0) continue;
    const line = lineFor(b.player, b.team);
    line.bowling = b;
    line.impact += b.wickets * WICKET_IMPACT;
  }
  return [...lines.values()].sort((x, y) => y.impact - x.impact);
}

/** Most runs first; fewer balls breaks ties. */
export function topBatters(match: CompletedMatch, team: TeamId, limit = 3): PlayerBatting[] {
  return match.batting
    .filter((b) => b.team === team)
    .sort((x, y) => y.runs - x.runs || x.balls - y.balls)
    .slice(0, limit);
}

/** Most wickets first; fewer runs conceded breaks ties. */
export function topBowlers(match: CompletedMatch, team: TeamId, limit = 3): PlayerBowling[] {
  return match.bowling
    .filter((b) => b.team === team && b.legalBalls > 0)
    .sort((x, y) => y.wickets - x.wickets || x.runsConceded - y.runsConceded)
    .slice(0, limit);
}

/** "45* (30)" */
export function battingText(b: PlayerBatting): string {
  return `${b.runs}${b.out ? '' : '*'} (${b.balls})`;
}

/** "2/18 (3.2 ov)" */
export function bowlingText(b: PlayerBowling): string {
  return `${b.wickets}/${b.runsConceded} (${ballsToOvers(b.legalBalls)} ov)`;
}

/** "45* (30) · 2/18 (3.2 ov)", or "" for a player who did neither. */
export function performerText(line: PerformerLine): string {
  return [line.batting && battingText(line.batting), line.bowling && bowlingText(line.bowling)]
    .filter(Boolean)
    .join(' · ');
}
