import {
  battingLeaders,
  bowlingLeaders,
  type BattingLeader,
  type BowlingLeader,
  type CompletedMatch,
  type PlayerId,
  type TeamId,
} from '@/domain';
import { toCompletedMatch, type MatchResultRecord, type MatchRoster, type WithId } from '@/data';
import type { MatchScope } from '../matches/hooks';

export interface StatsView {
  matches: number;
  totals: { runs: number; wickets: number; fours: number; sixes: number };
  /** Most runs first. */
  batting: BattingLeader[];
  /** Most wickets first. */
  bowling: BowlingLeader[];
  /** Matches each player batted or bowled in. */
  appearances: Map<PlayerId, number>;
  /** Most awards first. */
  playerOfMatch: { player: PlayerId; count: number }[];
  highestScore: { player: PlayerId; runs: number; balls: number; notOut: boolean } | null;
  bestBowling: { player: PlayerId; wickets: number; runs: number; legalBalls: number } | null;
  highestTotal: { team: TeamId; runs: number; wickets: number } | null;
  playerName: (player: PlayerId) => string;
  teamName: (team: TeamId) => string;
}

export function inScope(record: MatchResultRecord, scope: MatchScope): boolean {
  if (scope.kind === 'all') return true;
  if (scope.kind === 'quick') return record.stage === 'quick';
  return record.tournamentId === scope.id;
}

const normalize = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Stats for the matches in `scope`. A tournament keeps its own player ids; across tournaments
 * and quick matches the same person gets a new id each time, so players are matched by name.
 */
export function buildStats(
  results: readonly WithId<MatchResultRecord>[],
  rosters: Readonly<Record<string, MatchRoster>>,
  scope: MatchScope,
): StatsView {
  const byName = scope.kind !== 'tournament';
  const names = new Map<PlayerId, string>();
  const teams = new Map<TeamId, string>();

  const keyOf = (matchId: string, player: PlayerId): PlayerId => {
    const name = rosters[matchId]?.players[player]?.name;
    if (!name) return player;
    const key = byName ? `name:${normalize(name)}` : player;
    if (!names.has(key)) names.set(key, name.trim());
    return key;
  };

  const picked = results.filter((r) => inScope(r, scope));
  const matches: CompletedMatch[] = picked.map((record) => {
    for (const [team, name] of Object.entries(rosters[record.id]?.teams ?? {})) {
      teams.set(team, name);
    }
    const m = toCompletedMatch(record);
    return {
      ...m,
      batting: m.batting.map((b) => ({ ...b, player: keyOf(m.id, b.player) })),
      bowling: m.bowling.map((b) => ({ ...b, player: keyOf(m.id, b.player) })),
      playerOfMatch: m.playerOfMatch ? keyOf(m.id, m.playerOfMatch) : null,
    };
  });

  const totals = { runs: 0, wickets: 0, fours: 0, sixes: 0 };
  const appearances = new Map<PlayerId, number>();
  const awards = new Map<PlayerId, number>();
  let highestScore: StatsView['highestScore'] = null;
  let bestBowling: StatsView['bestBowling'] = null;
  let highestTotal: StatsView['highestTotal'] = null;

  for (const m of matches) {
    for (const inn of m.innings) {
      totals.runs += inn.runs;
      totals.wickets += inn.wickets;
      if (!highestTotal || inn.runs > highestTotal.runs) {
        highestTotal = { team: inn.battingTeam, runs: inn.runs, wickets: inn.wickets };
      }
    }
    const played = new Set<PlayerId>();
    for (const b of m.batting) {
      totals.fours += b.fours;
      totals.sixes += b.sixes;
      played.add(b.player);
      if (
        !highestScore ||
        b.runs > highestScore.runs ||
        (b.runs === highestScore.runs && b.balls < highestScore.balls)
      ) {
        highestScore = { player: b.player, runs: b.runs, balls: b.balls, notOut: !b.out };
      }
    }
    for (const b of m.bowling) {
      if (b.legalBalls === 0) continue;
      played.add(b.player);
      if (
        !bestBowling ||
        b.wickets > bestBowling.wickets ||
        (b.wickets === bestBowling.wickets && b.runsConceded < bestBowling.runs)
      ) {
        bestBowling = {
          player: b.player,
          wickets: b.wickets,
          runs: b.runsConceded,
          legalBalls: b.legalBalls,
        };
      }
    }
    for (const p of played) appearances.set(p, (appearances.get(p) ?? 0) + 1);
    if (m.playerOfMatch) awards.set(m.playerOfMatch, (awards.get(m.playerOfMatch) ?? 0) + 1);
  }

  return {
    matches: matches.length,
    totals,
    batting: battingLeaders(matches),
    bowling: bowlingLeaders(matches).filter((b) => b.legalBalls > 0),
    appearances,
    playerOfMatch: [...awards]
      .map(([player, count]) => ({ player, count }))
      .sort((a, b) => b.count - a.count || a.player.localeCompare(b.player)),
    highestScore,
    bestBowling,
    highestTotal,
    playerName: (player) => names.get(player) ?? 'Unknown player',
    teamName: (team) => teams.get(team) ?? 'Unknown team',
  };
}
