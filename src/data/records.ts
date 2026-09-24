import {
  summarizeMatch,
  type CompletedMatch,
  type MatchEvent,
  type MatchSetup,
  type MatchState,
  type PlayerId,
} from '@/domain';
import type { EventRecord, MatchMeta, MatchResultRecord } from './schemas';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** An event as stored, before `by` and `at` are added: for new players it includes their name. */
export type StoredEvent = DistributiveOmit<EventRecord, 'by' | 'at'>;

export function toStoredEvent(event: MatchEvent, playerName?: string): StoredEvent {
  switch (event.type) {
    case 'add_player':
      if (!playerName) throw new Error('A new player needs a name');
      return { ...event, playerName };
    case 'set_player_of_match':
      return event.player === null
        ? { type: event.type }
        : { type: event.type, player: event.player };
    case 'delivery': {
      const { wicket, extra, ...rest } = event;
      return {
        ...rest,
        ...(extra ? { extra } : {}),
        ...(wicket
          ? {
              wicket: {
                kind: wicket.kind,
                playerOut: wicket.playerOut,
                ...(wicket.fielder ? { fielder: wicket.fielder } : {}),
              },
            }
          : {}),
      };
    }
    default:
      return event;
  }
}

export function toDomainEvent(record: EventRecord): MatchEvent {
  switch (record.type) {
    case 'set_openers':
      return { type: record.type, striker: record.striker, nonStriker: record.nonStriker };
    case 'set_bowler':
      return { type: record.type, bowler: record.bowler };
    case 'delivery':
      return {
        type: record.type,
        runs: record.runs,
        ...(record.extra ? { extra: record.extra } : {}),
        ...(record.wicket
          ? {
              wicket: {
                kind: record.wicket.kind,
                playerOut: record.wicket.playerOut,
                ...(record.wicket.fielder ? { fielder: record.wicket.fielder } : {}),
              },
            }
          : {}),
      };
    case 'new_batter':
      return { type: record.type, batter: record.batter };
    case 'retire':
      return { type: record.type, batter: record.batter, kind: record.kind };
    case 'set_overs':
      return { type: record.type, overs: record.overs };
    case 'add_player':
      return { type: record.type, team: record.team, player: record.player };
    case 'set_player_of_match':
      return { type: record.type, player: record.player ?? null };
    case 'swap_strike':
    case 'end_innings':
      return { type: record.type };
  }
}

/** The engine's setup for a stored match. Squads keep the order players were listed in. */
export function toMatchSetup(meta: MatchMeta): MatchSetup {
  const squad = (team: string) =>
    Object.entries(meta.players)
      .filter(([, p]) => p.team === team)
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([pid]) => pid);
  return {
    teamA: meta.teamA,
    teamB: meta.teamB,
    squads: { [meta.teamA]: squad(meta.teamA), [meta.teamB]: squad(meta.teamB) },
    oversPerInnings: meta.oversPerInnings,
    toss: meta.toss,
  };
}

/** Display names for everyone in the match, including players added mid-game. */
export function playerNames(
  meta: MatchMeta,
  records: readonly EventRecord[],
): Record<PlayerId, string> {
  const names: Record<PlayerId, string> = {};
  for (const [pid, p] of Object.entries(meta.players)) names[pid] = p.name;
  for (const r of records) if (r.type === 'add_player') names[r.player] = r.playerName;
  return names;
}

/** A stored result as the input standings and leaderboards take. */
export function toCompletedMatch(record: MatchResultRecord & { id: string }): CompletedMatch {
  return {
    id: record.id,
    teamA: record.teamA,
    teamB: record.teamB,
    oversPerInnings: record.oversPerInnings,
    result: record.result,
    innings: record.innings,
    batting: record.batting,
    bowling: record.bowling,
    playerOfMatch: record.playerOfMatch ?? null,
  };
}

export function toMatchResultRecord(
  matchId: string,
  meta: MatchMeta,
  state: MatchState,
): MatchResultRecord {
  const summary = summarizeMatch(matchId, state);
  return {
    stage: meta.stage,
    ...(meta.tournamentId ? { tournamentId: meta.tournamentId } : {}),
    teamA: summary.teamA,
    teamB: summary.teamB,
    oversPerInnings: summary.oversPerInnings,
    result: summary.result,
    innings: summary.innings,
    batting: summary.batting,
    bowling: summary.bowling,
    ...(summary.playerOfMatch ? { playerOfMatch: summary.playerOfMatch } : {}),
  };
}
