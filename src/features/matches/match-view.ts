import {
  replay,
  requiredRunRate,
  runRate,
  target,
  ballsRemaining,
  type InningsState,
  type MatchEvent,
  type MatchState,
  type PlayerId,
  type TeamId,
} from '@/domain';
import { toMatchSetup, type MatchMeta, type MatchSnapshot } from '@/data';

/** A match as the viewer screens show it: the replayed state plus names. */
export interface MatchView {
  id: string;
  meta: MatchMeta;
  /** Next event's sequence number; needed to append or undo. */
  head: number;
  events: MatchEvent[];
  state: MatchState;
  /** Innings in which at least one batter has come in, in playing order. */
  innings: InningsState[];
  /** Figures for the innings in progress; null before the first ball or after the match. */
  live: LiveFigures | null;
  teamName: (team: TeamId) => string;
  playerName: (player: PlayerId) => string;
}

export interface LiveFigures {
  innings: InningsState;
  runRate: number;
  /** Second innings only. */
  chase: { target: number; runsNeeded: number; ballsLeft: number; requiredRate: number } | null;
}

export function buildMatchView(snapshot: MatchSnapshot): MatchView {
  const state = replay(toMatchSetup(snapshot.meta), snapshot.events);
  const innings = state.innings.filter((inn) => inn.battingOrder.length > 0);
  const current = state.innings[state.innings.length - 1];

  let live: LiveFigures | null = null;
  if (state.status === 'in_progress' && current && current.battingOrder.length > 0) {
    const t = target(state);
    live = {
      innings: current,
      runRate: runRate(current.runs, current.legalBalls),
      chase:
        t === null
          ? null
          : {
              target: t,
              runsNeeded: Math.max(0, t - current.runs),
              ballsLeft: ballsRemaining(state),
              requiredRate: requiredRunRate(state) ?? 0,
            },
    };
  }

  return {
    id: snapshot.id,
    meta: snapshot.meta,
    head: snapshot.head,
    events: snapshot.events,
    state,
    innings,
    live,
    teamName: (id) => snapshot.meta.teams[id]?.name ?? 'Unknown team',
    playerName: (id) => snapshot.names[id] ?? 'Unknown player',
  };
}
