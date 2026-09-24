import {
  applyEvent,
  createMatch,
  currentInnings,
  type MatchEvent,
  type MatchSetup,
  type MatchState,
  type PlayerId,
  type TeamId,
} from '@/domain';
import type { MatchMeta, Stage } from '@/data/schemas';
import type { LegacyInnings, LegacyMatch, LegacyTeam } from './legacy';
import { pushIdTime } from './legacy';
import { parseBall, Roster, type ParsedBall } from './parse';

/** Players created up to this long after a match started were picked before the first ball. */
const SQUAD_GRACE_MS = 60_000;

export interface ConvertedMatch {
  meta: MatchMeta;
  setup: MatchSetup;
  /** Each event with the name of the player it adds, if any. */
  events: { event: MatchEvent; playerName?: string }[];
  state: MatchState;
  /** Where v1's data broke a rule and the migration had to interpret it. */
  adjustments: string[];
}

export interface MatchContext {
  teams: Readonly<Record<TeamId, LegacyTeam>>;
  stage: Stage;
  tournamentId?: string;
  fixtureId?: string;
  createdBy: string;
}

/**
 * Rebuilds a v1 match as an event log by reading its ball-by-ball commentary
 * and replaying it through the engine, so every rule is checked on the way.
 * Throws with a readable message when the old data can't be converted at all.
 */
export function convertMatch(match: LegacyMatch, ctx: MatchContext): ConvertedMatch {
  const teamIds = [match.teamA, match.teamB] as const;
  const teams = teamIds.map((id) => {
    const team = ctx.teams[id];
    if (!team) throw new Error(`Team ${id} no longer exists`);
    return team;
  });

  // The squad is who existed when the match began; later players join with add_player.
  const squads: Record<TeamId, PlayerId[]> = {};
  const late = new Map<PlayerId, { team: TeamId; name: string }>();
  const meta: MatchMeta = {
    stage: ctx.stage,
    ...(ctx.tournamentId ? { tournamentId: ctx.tournamentId } : {}),
    ...(ctx.fixtureId ? { fixtureId: ctx.fixtureId } : {}),
    teamA: match.teamA,
    teamB: match.teamB,
    teams: {},
    players: {},
    oversPerInnings: match.oversLimit,
    toss: { winner: match.toss.winner, decision: match.toss.choice },
    createdAt: match.timestamp,
    createdBy: ctx.createdBy,
    locked: match.status === 'completed',
  };
  teamIds.forEach((teamId, i) => {
    const team = teams[i] as LegacyTeam;
    meta.teams[teamId] = { name: team.name.trim() };
    const squad: PlayerId[] = [];
    for (const [pid, player] of byCreation(team)) {
      const created = pushIdTime(pid);
      if (created !== null && created > match.timestamp + SQUAD_GRACE_MS) {
        late.set(pid, { team: teamId, name: player.name.trim() });
      } else {
        meta.players[pid] = { name: player.name.trim(), team: teamId, order: squad.length };
        squad.push(pid);
      }
    }
    squads[teamId] = squad;
  });

  const setup: MatchSetup = {
    teamA: match.teamA,
    teamB: match.teamB,
    squads,
    oversPerInnings: match.oversLimit,
    toss: meta.toss,
  };

  let state = createMatch(setup);
  const events: ConvertedMatch['events'] = [];
  const adjustments: string[] = [];
  const rosters = Object.fromEntries(
    teamIds.map((teamId, i) => {
      const players = (teams[i] as LegacyTeam).players;
      return [
        teamId,
        new Roster(
          Object.fromEntries(Object.entries(players).map(([pid, p]) => [pid, p.name.trim()])),
        ),
      ];
    }),
  ) as Record<TeamId, Roster>;

  for (const number of [1, 2] as const) {
    const legacy = inningsOf(match, number);
    if (!legacy) break;
    const inn = currentInnings(state);
    if (inn.number !== number) throw new Error(`Innings ${number} started before it should have`);
    const legacyTeam = legacy.teamId ?? legacy.battingTeam;
    if (legacyTeam && legacyTeam !== inn.battingTeam) {
      throw new Error(`Innings ${number}: the toss says the other team batted`);
    }

    const balls: ParsedBall[] = [];
    for (const entry of legacy.commentaryLog) {
      if (entry.type !== 'ball' || !('text' in entry)) continue;
      try {
        balls.push(
          parseBall(entry, rosters[inn.bowlingTeam] as Roster, rosters[inn.battingTeam] as Roster),
        );
      } catch (error) {
        throw new Error(`Innings ${number}, ball ${balls.length + 1}: ${(error as Error).message}`);
      }
    }
    const play = inningsReplay(number, legacy, balls);
    balls.forEach((_, i) => {
      try {
        play(i);
      } catch (error) {
        throw new Error(`Innings ${number}, ball ${i + 1}: ${(error as Error).message}`);
      }
    });
    if (state.status !== 'complete' && currentInnings(state).number === number) {
      // v1 ended the innings by hand (or the overs were changed); only end it if v1 did.
      if (number === 1 || match.status === 'completed') apply({ type: 'end_innings' });
    }
  }

  if (match.potm && state.status === 'complete') {
    ensurePlayer(match.potm.playerId);
    apply({ type: 'set_player_of_match', player: match.potm.playerId });
  }

  for (const roster of Object.values(rosters)) {
    for (const [oldName, pid] of roster.renamed) {
      adjustments.push(`"${oldName}" in the commentary is ${nameOf(pid)} (renamed since)`);
    }
  }
  return { meta, setup, events, state, adjustments };

  function apply(event: MatchEvent, playerName?: string) {
    state = applyEvent(state, event);
    events.push(playerName ? { event, playerName } : { event });
  }

  /** A player the v1 app added mid-match is added just before they first take part. */
  function ensurePlayer(pid: PlayerId) {
    const added = late.get(pid);
    if (!added) return;
    late.delete(pid);
    apply({ type: 'add_player', team: added.team, player: pid }, added.name);
  }

  function nameOf(pid: PlayerId): string {
    for (const team of teams) {
      const player = team.players[pid];
      if (player) return player.name.trim();
    }
    return pid;
  }

  /**
   * Plays one innings of commentary, one ball per call. The commentary is trusted for who
   * bowled and who faced; who was out and who came in next come from the innings record,
   * because v1 printed the striker's name for every "Bowled!" even when the scorer marked
   * the non-striker out.
   */
  function inningsReplay(number: 1 | 2, legacy: LegacyInnings, balls: readonly ParsedBall[]) {
    /** Batters in the order they came to the crease. */
    const arrivals = Object.entries(legacy.playerStats)
      .filter(([, s]) => s.batOrder !== undefined)
      .sort(([, a], [, b]) => (a.batOrder ?? 0) - (b.batOrder ?? 0))
      .map(([pid]) => pid);
    const arrived = new Set<PlayerId>();
    let wickets = 0;

    const bringIn = (pid: PlayerId) => {
      ensurePlayer(pid);
      arrived.add(pid);
      if (currentInnings(state).awaitingBatter !== null) apply({ type: 'new_batter', batter: pid });
    };

    /** v1 let scorers swap a batter at the crease for another without a wicket: retired hurt. */
    const replaceBatter = (index: number, incoming: PlayerId) => {
      const inn = currentInnings(state);
      const atCrease = [inn.striker, inn.nonStriker].filter((p): p is PlayerId => p !== null);
      const nextAppearance = (pid: PlayerId) => {
        const found = balls.findIndex(
          (b, i) => i > index && (b.striker === pid || b.delivery.wicket?.playerOut === pid),
        );
        return found < 0 ? Infinity : found;
      };
      // Whoever bats again soonest stayed; the other one left.
      const leaving = [...atCrease].sort((a, b) => nextAppearance(b) - nextAppearance(a))[0];
      if (!leaving) throw new Error(`${nameOf(incoming)} faced but nobody was at the crease`);
      adjustments.push(
        `Innings ${number}, ball ${index + 1}: ${nameOf(incoming)} replaced ${nameOf(leaving)} ` +
          'without a wicket; recorded as retired hurt',
      );
      apply({ type: 'retire', batter: leaving, kind: 'retired_hurt' });
      bringIn(incoming);
    };

    return (index: number) => {
      const ball = balls[index] as ParsedBall;
      let inn = currentInnings(state);
      if (inn.striker === null && inn.nonStriker === null && inn.awaitingBatter === null) {
        const nonStriker = arrivals.slice(0, 2).find((pid) => pid !== ball.striker);
        if (!nonStriker) throw new Error("Can't tell who opened with the first batter");
        for (const pid of [ball.striker, nonStriker]) {
          ensurePlayer(pid);
          arrived.add(pid);
        }
        apply({ type: 'set_openers', striker: ball.striker, nonStriker });
      }
      ensurePlayer(ball.bowler);
      if (currentInnings(state).bowler !== ball.bowler) {
        apply({ type: 'set_bowler', bowler: ball.bowler });
      }

      inn = currentInnings(state);
      if (inn.striker !== ball.striker && inn.nonStriker !== ball.striker) {
        replaceBatter(index, ball.striker);
        inn = currentInnings(state);
      }
      if (inn.striker !== ball.striker) {
        // v1 kept the new batter on strike after a wicket at the end of an over,
        // and let scorers swap strike by hand; follow who actually faced.
        apply({ type: 'swap_strike' });
        inn = currentInnings(state);
      }

      const nextIn = () => arrivals.find((pid) => !arrived.has(pid)) ?? ball.nextBatter;
      let delivery = ball.delivery;
      if (delivery.wicket) {
        // A batter added mid-match was added before the wicket, or the side would be all out.
        const incoming = nextIn();
        if (incoming) ensurePlayer(incoming);
        const recorded = legacy.outPlayers[wickets];
        wickets += 1;
        let wicket = { ...delivery.wicket, playerOut: recorded ?? delivery.wicket.playerOut };
        if (wicket.kind !== 'run_out' && wicket.playerOut !== inn.striker) {
          adjustments.push(
            `Innings ${number}, ball ${index + 1}: v1 has the non-striker ${nameOf(wicket.playerOut)} ` +
              `${wicket.kind}; migrated as run out, so the bowler is not credited`,
          );
          wicket = { ...wicket, kind: 'run_out' };
        }
        if (wicket.fielder) ensurePlayer(wicket.fielder);
        delivery = { ...delivery, wicket };
      }
      apply(delivery);

      if (state.status !== 'complete' && currentInnings(state).awaitingBatter !== null) {
        const next = nextIn();
        if (!next) throw new Error('The side was not all out, but nobody came in');
        bringIn(next);
      }
    };
  }
}

function inningsOf(match: LegacyMatch, number: 1 | 2): LegacyInnings | undefined {
  const done = number === 1 ? match.innings1 : match.innings2;
  if (done) return done;
  return match.currentInnings === number ? match.state : undefined;
}

/** A team's players in the order they were created (Firebase push ids encode the time). */
export function byCreation(team: LegacyTeam): [PlayerId, { name: string }][] {
  return Object.entries(team.players).sort(
    ([a], [b]) => (pushIdTime(a) ?? 0) - (pushIdTime(b) ?? 0) || a.localeCompare(b),
  );
}
