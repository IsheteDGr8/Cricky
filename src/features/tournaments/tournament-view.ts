import {
  battingLeaders,
  bowlingLeaders,
  bracketForFormat,
  computeStandings,
  resolveBracket,
  type BattingLeader,
  type BowlingLeader,
  type PlayerId,
  type ResolvedBracket,
  type StandingRow,
  type TeamId,
} from '@/domain';
import {
  toCompletedMatch,
  type Listed,
  type MatchResultRecord,
  type MatchSummary,
  type Team,
  type Tournament,
  type WithId,
} from '@/data';

export interface GroupTable {
  group: string;
  rows: StandingRow[];
}

/** Everything a tournament page shows, derived from what the database stores. */
export interface TournamentView {
  tournament: WithId<Tournament>;
  teams: WithId<Team>[];
  groups: GroupTable[];
  /** null when the tournament has no playoffs. */
  bracket: ResolvedBracket | null;
  /** Newest first. */
  matches: WithId<MatchSummary>[];
  batting: BattingLeader[];
  bowling: BowlingLeader[];
  teamName: (team: TeamId) => string;
  playerName: (player: PlayerId) => string;
  /** Data that could not be shown, so gaps are explained rather than silent. */
  problems: string[];
}

export function buildTournamentView(
  tournament: WithId<Tournament>,
  teams: WithId<Team>[],
  results: Listed<MatchResultRecord>,
  summaries: Listed<MatchSummary>,
): TournamentView {
  const problems: string[] = [];
  if (results.invalid.length) problems.push(`${results.invalid.length} unreadable match results`);
  if (summaries.invalid.length) problems.push(`${summaries.invalid.length} unreadable matches`);

  const teamNames = new Map(teams.map((t) => [t.id, t.name]));
  const playerNames = new Map<PlayerId, string>();
  for (const team of teams) {
    for (const [pid, p] of Object.entries(team.players)) playerNames.set(pid, p.name);
  }

  const completed = results.items.map(toCompletedMatch);
  const groupStage = completed.filter((_, i) => results.items[i]?.stage === 'group');
  const groupNames = [...new Set(teams.map((t) => t.group))].sort();
  const groups = groupNames.map((group) => ({
    group,
    rows: computeStandings(
      teams.filter((t) => t.group === group).map((t) => t.id),
      groupStage,
    ),
  }));

  let bracket: ResolvedBracket | null = null;
  const shape = bracketForFormat(tournament.playoffFormat, groupNames, {
    thirdPlace: tournament.thirdPlace,
  });
  if (shape) {
    const rankings = Object.fromEntries(groups.map((g) => [g.group, g.rows.map((r) => r.team)]));
    try {
      bracket = resolveBracket(shape, rankings, tournament.playoffWinners ?? {});
    } catch (error) {
      problems.push(`Playoffs: ${(error as Error).message}`);
    }
  }

  return {
    tournament,
    teams,
    groups,
    bracket,
    matches: summaries.items,
    batting: battingLeaders(completed),
    bowling: bowlingLeaders(completed),
    teamName: (id) => teamNames.get(id) ?? 'Unknown team',
    playerName: (id) => playerNames.get(id) ?? 'Unknown player',
    problems,
  };
}
