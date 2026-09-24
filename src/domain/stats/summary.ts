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

export interface ScoreSummary {
  status: 'scheduled' | 'live' | 'complete';
  innings: { battingTeam: TeamId; runs: number; wickets: number; legalBalls: number }[];
  result?:
    { kind: 'tie' } | { kind: 'win'; winner: TeamId; by: 'runs' | 'wickets'; margin: number };
}

/** The few numbers a match list shows: status, score per innings and the result. */
export function scoreSummary(state: MatchState): ScoreSummary {
  const started = state.innings.some((inn) => inn.battingOrder.length > 0);
  const status = state.status === 'complete' ? 'complete' : started ? 'live' : 'scheduled';
  const innings = state.innings
    .filter((inn) => inn.number === 1 || inn.battingOrder.length > 0 || state.status === 'complete')
    .map((inn) => ({
      battingTeam: inn.battingTeam,
      runs: inn.runs,
      wickets: inn.wickets,
      legalBalls: inn.legalBalls,
    }));

  const summary: ScoreSummary = { status, innings };
  const r = state.result;
  if (r?.kind === 'tie') summary.result = { kind: 'tie' };
  if (r?.kind === 'win') {
    summary.result = {
      kind: 'win',
      winner: r.winner,
      by: r.margin.by,
      margin: r.margin.by === 'runs' ? r.margin.runs : r.margin.wickets,
    };
  }
  return summary;
}

/** Net run rate counts an all-out innings as if the full quota of overs was faced. */
export function nrrBalls(innings: InningsSummary, oversPerInnings: number): number {
  return innings.allOut ? oversPerInnings * BALLS_PER_OVER : innings.legalBalls;
}
