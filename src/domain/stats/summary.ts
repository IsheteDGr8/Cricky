import {
  BALLS_PER_OVER,
  type MatchResult,
  type MatchState,
  type PlayerId,
  type TeamId,
} from '../scoring';

export interface InningsSummary {
  battingTeam: TeamId;
  bowlingTeam: TeamId;
  runs: number;
  wickets: number;
  legalBalls: number;
  allOut: boolean;
}

export interface PlayerBatting {
  player: PlayerId;
  team: TeamId;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
}

export interface PlayerBowling {
  player: PlayerId;
  team: TeamId;
  legalBalls: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
}

/** Everything standings and leaderboards need from one completed match. */
export interface CompletedMatch {
  id: string;
  teamA: TeamId;
  teamB: TeamId;
  oversPerInnings: number;
  result: MatchResult;
  innings: [InningsSummary, InningsSummary];
  batting: PlayerBatting[];
  bowling: PlayerBowling[];
  playerOfMatch: PlayerId | null;
}

export function summarizeMatch(id: string, state: MatchState): CompletedMatch {
  const [first, second] = state.innings;
  if (state.status !== 'complete' || !state.result || !first || !second) {
    throw new Error(`Match ${id} is not complete`);
  }

  const innings = state.innings.map<InningsSummary>((inn) => ({
    battingTeam: inn.battingTeam,
    bowlingTeam: inn.bowlingTeam,
    runs: inn.runs,
    wickets: inn.wickets,
    legalBalls: inn.legalBalls,
    allOut: inn.endReason === 'all_out',
  })) as [InningsSummary, InningsSummary];

  const batting = state.innings.flatMap((inn) =>
    inn.battingOrder.map<PlayerBatting>((player) => {
      const line = inn.batters[player];
      return {
        player,
        team: inn.battingTeam,
        runs: line?.runs ?? 0,
        balls: line?.balls ?? 0,
        fours: line?.fours ?? 0,
        sixes: line?.sixes ?? 0,
        out: Boolean(line?.dismissal),
      };
    }),
  );

  const bowling = state.innings.flatMap((inn) =>
    inn.bowlingOrder.map<PlayerBowling>((player) => {
      const line = inn.bowlers[player];
      return {
        player,
        team: inn.bowlingTeam,
        legalBalls: line?.legalBalls ?? 0,
        runsConceded: line?.runsConceded ?? 0,
        wickets: line?.wickets ?? 0,
        maidens: line?.maidens ?? 0,
      };
    }),
  );

  return {
    id,
    teamA: state.teamA,
    teamB: state.teamB,
    oversPerInnings: state.oversPerInnings,
    result: state.result,
    innings,
    batting,
    bowling,
    playerOfMatch: state.playerOfMatch,
  };
}

/** Net run rate counts an all-out innings as if the full quota of overs was faced. */
export function nrrBalls(innings: InningsSummary, oversPerInnings: number): number {
  return innings.allOut ? oversPerInnings * BALLS_PER_OVER : innings.legalBalls;
}
